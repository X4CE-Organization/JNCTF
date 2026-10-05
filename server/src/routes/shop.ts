import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { optionalUser, requireAuth } from '../middleware/auth.js';
import { audit, notify } from '../lib/audit.js';
import { addPoints, grantQuota, quotaOf, spendPoints, type GrantKind } from '../lib/points.js';
import { getBool, getSetting } from '../lib/settings.js';

export const shopRouter = Router();

function orderNo(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `JK${stamp}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** 首次启动时把默认商品补进去，管理员之后可在后台改价 */
export async function ensureDefaultShopItems(): Promise<void> {
  const defaults = [
    {
      slug: 'problem-1',
      name: '出一道题目',
      description: '获得 1 次出题资格，可以在「创作中心」里发布自己的题目。',
      icon: 'flag',
      price: 50,
      kind: 'problem',
      grantAmount: 1,
      sort: 10,
    },
    {
      slug: 'contest-1',
      name: '创建 1 次比赛',
      description: '获得 1 次办赛资格，可以自己办一场解题赛。',
      icon: 'trophy',
      price: 120,
      kind: 'contest',
      grantAmount: 1,
      sort: 20,
    },
    {
      slug: 'contest-5',
      name: '创建 5 次比赛',
      description: '一次拿到 5 次办赛资格，比单买划算。',
      icon: 'trophy',
      price: 500,
      kind: 'contest',
      grantAmount: 5,
      sort: 30,
    },
  ];
  for (const item of defaults) {
    await prisma.shopItem.upsert({ where: { slug: item.slug }, create: item, update: {} });
  }
}

shopRouter.get(
  '/items',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const rows = await prisma.shopItem.findMany({
      where: viewer && viewer.role !== 'USER' && req.query.all === 'true' ? {} : { active: true },
      orderBy: [{ sort: 'asc' }, { price: 'asc' }, { id: 'asc' }],
    });
    const sold = await prisma.shopOrder.groupBy({ by: ['itemId'], _count: { _all: true } });
    const soldMap = new Map(sold.map((s) => [String(s.itemId), s._count._all]));

    let points = 0;
    let myCounts = new Map<string, number>();
    let quota = { problem: { total: 0, used: 0, remaining: 0 }, contest: { total: 0, used: 0, remaining: 0 } };
    if (viewer) {
      points = (await prisma.user.findUnique({ where: { id: viewer.id }, select: { points: true } }))?.points ?? 0;
      const mine = await prisma.shopOrder.groupBy({ by: ['itemId'], where: { userId: viewer.id }, _count: { _all: true } });
      myCounts = new Map(mine.map((m) => [String(m.itemId), m._count._all]));
      quota = {
        problem: await quotaOf(viewer.id, 'problem'),
        contest: await quotaOf(viewer.id, 'contest'),
      };
    }

    return ok(res, {
      enabled: getBool('shop.enabled') && getBool('points.enabled'),
      title: getSetting('shop.title') || '积分商店',
      notice: getSetting('shop.notice'),
      points,
      quota,
      items: rows.map((item) => {
        const soldCount = soldMap.get(String(item.id)) ?? 0;
        const mineCount = myCounts.get(String(item.id)) ?? 0;
        const stockLeft = item.stock < 0 ? -1 : Math.max(0, item.stock - soldCount);
        const perUserLeft = item.maxPerUser <= 0 ? -1 : Math.max(0, item.maxPerUser - mineCount);
        return {
          id: item.id,
          slug: item.slug,
          name: item.name,
          description: item.description,
          icon: item.icon,
          price: item.price,
          kind: item.kind,
          grantAmount: item.grantAmount,
          stockLeft,
          perUserLeft,
          soldCount,
          soldOut: stockLeft === 0 || perUserLeft === 0,
          affordable: points >= item.price,
          active: item.active,
        };
      }),
    });
  }),
);

shopRouter.post(
  '/redeem',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (!getBool('points.enabled')) throw ApiError.forbidden('积分系统未开启');
    if (!getBool('shop.enabled')) throw ApiError.forbidden('商店未开启');
    const body = z.object({ itemId: z.union([z.string(), z.number()]) }).parse(req.body);
    const itemId = BigInt(body.itemId);

    const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
    if (!item || !item.active) throw ApiError.notFound('商品不存在或已下架');

    const soldCount = await prisma.shopOrder.count({ where: { itemId } });
    if (item.stock >= 0 && soldCount >= item.stock) throw ApiError.badRequest('这件商品已经兑完了');
    if (item.maxPerUser > 0) {
      const mine = await prisma.shopOrder.count({ where: { itemId, userId: user.id } });
      if (mine >= item.maxPerUser) throw ApiError.badRequest('这件商品你已经兑换到上限了');
    }

    const wallet = await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } });
    if ((wallet?.points ?? 0) < item.price) {
      throw ApiError.badRequest(`积分不足，当前 ${wallet?.points ?? 0}，需要 ${item.price}`);
    }

    // 先扣积分，再发资格，最后落订单；任何一步失败都会抛错给前端
    await spendPoints(user.id, item.price, `兑换「${item.name}」`, { refType: 'shop_item', refId: item.id });
    const order = await prisma.shopOrder.create({
      data: {
        orderNo: orderNo(),
        userId: user.id,
        itemId: item.id,
        itemName: item.name,
        kind: item.kind,
        price: item.price,
        status: 'PAID',
      },
    });
    await grantQuota(user.id, item.kind as GrantKind, item.grantAmount, { orderId: order.id, note: item.name });
    await audit(req, user, 'shop.redeem', 'shop_order', order.id, item.name);
    await notify(
      user.id,
      'SYSTEM',
      `兑换成功：${item.name}`,
      `已获得 ${item.grantAmount} 次${item.kind === 'problem' ? '出题' : '办赛'}资格`,
      '/creation',
    );

    const quota = {
      problem: await quotaOf(user.id, 'problem'),
      contest: await quotaOf(user.id, 'contest'),
    };
    const points = (await prisma.user.findUnique({ where: { id: user.id }, select: { points: true } }))?.points ?? 0;
    return ok(res, { orderNo: order.orderNo, points, quota, grantAmount: item.grantAmount, kind: item.kind }, 201);
  }),
);

shopRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(50, Math.max(1, Number(req.query.size) || 20));
    const [total, rows] = await Promise.all([
      prisma.shopOrder.count({ where: { userId: user.id } }),
      prisma.shopOrder.findMany({
        where: { userId: user.id },
        orderBy: { id: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        itemName: o.itemName,
        kind: o.kind,
        price: o.price,
        status: o.status,
        createdAt: o.createdAt,
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

/** 我的资格：创作中心用它决定能不能发题 / 办赛 */
shopRouter.get(
  '/quota',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const [points, problem, contest] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id }, select: { points: true } }),
      quotaOf(user.id, 'problem'),
      quotaOf(user.id, 'contest'),
    ]);
    return ok(res, {
      points: points?.points ?? 0,
      problem,
      contest,
      canCreateChallenge: user.role !== 'USER' || problem.remaining > 0,
      canCreateCompetition: user.role !== 'USER' || contest.remaining > 0,
      isStaff: user.role !== 'USER',
    });
  }),
);

/** 积分流水 */
shopRouter.get(
  '/point-logs',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(50, Math.max(1, Number(req.query.size) || 20));
    const [total, rows] = await Promise.all([
      prisma.pointLog.count({ where: { userId: user.id } }),
      prisma.pointLog.findMany({
        where: { userId: user.id },
        orderBy: { id: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((r) => ({ id: r.id, delta: r.delta, balance: r.balance, reason: r.reason, createdAt: r.createdAt })),
      total,
      page,
      size,
    });
  }),
);
