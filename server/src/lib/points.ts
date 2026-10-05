import { prisma } from './prisma.js';
import { ApiError } from './errors.js';
import { getBool, getInt } from './settings.js';

/**
 * 积分（商店货币）与等级分（榜单用的 score）是两套东西：
 * - score  ：解出题目累加，榜单按它排名，花不掉
 * - points ：解出题目同样累加，可以在商店换资格，会花掉
 * 每次变动都写 point_logs，方便对账。
 */
export interface PointResult {
  delta: number;
  balance: number;
}

export async function currentPoints(userId: bigint | number): Promise<number> {
  const row = await prisma.user.findUnique({ where: { id: BigInt(userId) }, select: { points: true } });
  return row?.points ?? 0;
}

export async function addPoints(
  userId: bigint | number,
  delta: number,
  reason: string,
  options: { refType?: string; refId?: bigint | number | null } = {},
): Promise<PointResult> {
  const id = BigInt(userId);
  if (!Number.isFinite(delta) || delta === 0) return { delta: 0, balance: await currentPoints(id) };

  const user = await prisma.user.findUnique({ where: { id }, select: { points: true } });
  if (!user) throw ApiError.notFound('用户不存在');
  let next = user.points + delta;
  if (next < 0) {
    if (!getBool('points.allow_negative')) {
      throw ApiError.badRequest(`积分不足，当前 ${user.points}，需要 ${Math.abs(delta)}`);
    }
    next = 0;
  }

  const updated = await prisma.user.update({ where: { id }, data: { points: next }, select: { points: true } });
  await prisma.pointLog.create({
    data: {
      userId: id,
      delta,
      balance: updated.points,
      reason: reason.slice(0, 120),
      refType: options.refType ?? null,
      refId: options.refId === null || options.refId === undefined ? null : BigInt(options.refId),
    },
  });
  return { delta, balance: updated.points };
}

export async function spendPoints(
  userId: bigint | number,
  amount: number,
  reason: string,
  options: { refType?: string; refId?: bigint | number | null } = {},
): Promise<PointResult> {
  if (amount <= 0) throw ApiError.badRequest('消耗积分必须为正数');
  return addPoints(userId, -amount, reason, options);
}

export function pointsPerSolve(): number {
  return Math.max(0, getInt('points.per_solve') || 1);
}

export function pointsPerFirstBlood(): number {
  return Math.max(0, getInt('points.first_blood_bonus'));
}

/* --------------------------------------------------------------- 资格配额 */

export type GrantKind = 'problem' | 'contest';

/** 发放资格（商店兑换后调用） */
export async function grantQuota(
  userId: bigint | number,
  kind: GrantKind,
  amount: number,
  options: { orderId?: bigint | number | null; note?: string } = {},
): Promise<void> {
  if (amount <= 0) return;
  await prisma.grant.create({
    data: {
      userId: BigInt(userId),
      kind,
      total: amount,
      used: 0,
      orderId: options.orderId === null || options.orderId === undefined ? null : BigInt(options.orderId),
      note: (options.note ?? '').slice(0, 200),
    },
  });
}

export interface QuotaSummary {
  total: number;
  used: number;
  remaining: number;
}

export async function quotaOf(userId: bigint | number, kind: GrantKind): Promise<QuotaSummary> {
  const rows = await prisma.grant.findMany({ where: { userId: BigInt(userId), kind } });
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const used = rows.reduce((sum, r) => sum + r.used, 0);
  return { total, used, remaining: Math.max(0, total - used) };
}

/**
 * 用掉一次资格。管理员不受限制（调用方先判断），这里只管扣减。
 * 从最早的一笔还有余额的资格开始扣，扣不到就报错。
 */
export async function consumeGrant(userId: bigint | number, kind: GrantKind): Promise<void> {
  const id = BigInt(userId);
  const rows = await prisma.grant.findMany({
    where: { userId: id, kind },
    orderBy: { id: 'asc' },
  });
  const usable = rows.find((r) => r.used < r.total);
  if (!usable) {
    throw ApiError.forbidden(kind === 'problem' ? '你还没有出题资格，去商店兑换一次吧' : '你还没有办赛资格，去商店兑换一次吧');
  }
  await prisma.grant.update({ where: { id: usable.id }, data: { used: { increment: 1 } } });
}
