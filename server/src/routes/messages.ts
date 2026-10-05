import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { notify } from '../lib/audit.js';
import { getBool, getInt } from '../lib/settings.js';
import { rateLimit } from '../lib/redis.js';

export const messageRouter = Router();

/** 会话标识：两个人的 id 排序后拼起来，保证双方算出来是同一个 key */
function conversationKey(a: bigint, b: bigint): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function brief(user: { id: bigint; username: string; displayName: string | null; avatar: string | null }) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatar: user.avatar ?? '',
  };
}

/** 未读数，顶栏红点用 */
messageRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const count = await prisma.directMessage.count({ where: { receiverId: user.id, readAt: null } });
    return ok(res, { unread: count });
  }),
);

/** 会话列表：每个对话取最后一条 + 未读数 */
messageRouter.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const rows = await prisma.directMessage.findMany({
      where: { OR: [{ senderId: user.id }, { receiverId: user.id }] },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatar: true } },
        receiver: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
      orderBy: { id: 'desc' },
      take: 400,
    });

    const map = new Map<string, any>();
    for (const row of rows) {
      if (!map.has(row.conversationKey)) {
        const other = row.senderId === user.id ? row.receiver : row.sender;
        map.set(row.conversationKey, {
          key: row.conversationKey,
          user: brief(other),
          lastMessage: row.content.slice(0, 80),
          lastAt: row.createdAt,
          lastFromMe: row.senderId === user.id,
          unread: 0,
        });
      }
      if (row.receiverId === user.id && !row.readAt) {
        map.get(row.conversationKey)!.unread += 1;
      }
    }

    return ok(res, { items: Array.from(map.values()).sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt)) });
  }),
);

/** 和某个人的聊天记录（拉到即标记为已读） */
messageRouter.get(
  '/with/:username',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const other = await prisma.user.findUnique({ where: { username: req.params.username! } });
    if (!other) throw ApiError.notFound('用户不存在');
    if (other.id === user.id) throw ApiError.badRequest('不能和自己私信');
    const key = conversationKey(user.id, other.id);

    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 50));
    const [total, rows] = await Promise.all([
      prisma.directMessage.count({ where: { conversationKey: key } }),
      prisma.directMessage.findMany({
        where: { conversationKey: key },
        orderBy: { id: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);

    await prisma.directMessage.updateMany({
      where: { conversationKey: key, receiverId: user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return ok(res, {
      user: brief(other),
      // 按时间正序返回，前端直接从上往下渲染
      items: rows.reverse().map((m) => ({
        id: m.id,
        content: m.content,
        mine: m.senderId === user.id,
        read: Boolean(m.readAt),
        createdAt: m.createdAt,
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

messageRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (!getBool('messages.enabled')) throw ApiError.forbidden('管理员已关闭私信功能');
    if (!(await rateLimit(`dm:${user.id}`, 3))) throw ApiError.tooMany('发得太快了');

    const body = z
      .object({
        to: z.string().trim().min(1),
        content: z.string().trim().min(1, '内容不能为空').max(2000),
      })
      .parse(req.body);

    const other = await prisma.user.findUnique({ where: { username: body.to } });
    if (!other) throw ApiError.notFound('用户不存在');
    if (other.id === user.id) throw ApiError.badRequest('不能给自己发私信');
    if (other.banned) throw ApiError.forbidden('对方账号不可用');
    if (other.hidden && user.role === 'USER') throw ApiError.forbidden('对方不接受私信');

    // 陌生人限制：关掉之后普通用户之间只有同队成员才能私信（管理员不受限）
    if (!getBool('messages.allow_strangers') && user.role === 'USER') {
      const [mine, theirs] = await Promise.all([
        prisma.teamMember.findUnique({ where: { userId: user.id }, select: { teamId: true } }),
        prisma.teamMember.findUnique({ where: { userId: other.id }, select: { teamId: true } }),
      ]);
      if (!mine || !theirs || mine.teamId !== theirs.teamId) {
        throw ApiError.forbidden('本站已关闭陌生人私信，只有同队成员之间可以发');
      }
    }

    const limit = Math.max(50, getInt('messages.max_length') || 2000);
    const created = await prisma.directMessage.create({
      data: {
        conversationKey: conversationKey(user.id, other.id),
        senderId: user.id,
        receiverId: other.id,
        content: body.content.slice(0, limit),
      },
    });
    await notify(other.id, 'MESSAGE', `来自 ${user.username} 的私信`, body.content.slice(0, 60), `/messages?to=${user.username}`);
    return ok(res, { id: created.id, createdAt: created.createdAt }, 201);
  }),
);

/** 按用户名把会话标记为已读 */
messageRouter.post(
  '/read',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const username = String(req.body?.username ?? '').trim();
    if (!username) return ok(res, { ok: true });
    const other = await prisma.user.findUnique({ where: { username } });
    if (!other) throw ApiError.notFound('用户不存在');
    await prisma.directMessage.updateMany({
      where: { conversationKey: conversationKey(user.id, other.id), receiverId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return ok(res, { ok: true });
  }),
);

/** 删掉整个会话（只删自己这边的记录） */
messageRouter.delete(
  '/with/:username',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const other = await prisma.user.findUnique({ where: { username: req.params.username! } });
    if (!other) throw ApiError.notFound('用户不存在');
    await prisma.directMessage.deleteMany({
      where: { conversationKey: conversationKey(user.id, other.id), senderId: user.id },
    });
    await prisma.directMessage.updateMany({
      where: { conversationKey: conversationKey(user.id, other.id), receiverId: user.id },
      data: { readAt: new Date() },
    });
    return ok(res, { ok: true });
  }),
);
