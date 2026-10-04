import type { Request } from 'express';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

export function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0]!.trim();
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.length) return real.trim();
  return req.ip ?? req.socket?.remoteAddress ?? '';
}

/** 写一条操作日志。审计失败不影响主流程。 */
export async function audit(
  req: Request | null,
  actor: { id: bigint | number; username: string } | null,
  action: string,
  targetType?: string,
  targetId?: bigint | number | string | null,
  detail?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor ? BigInt(actor.id) : null,
        actorName: actor?.username ?? null,
        action,
        targetType: targetType ?? null,
        targetId: targetId === null || targetId === undefined ? null : String(targetId),
        detail: detail ? detail.slice(0, 1000) : null,
        ip: req ? clientIp(req) : null,
      },
    });
  } catch (err) {
    logger.warn({ err }, '写入审计日志失败');
  }
}

/** 推一条站内通知 */
export async function notify(
  userId: bigint | number,
  type: string,
  title: string,
  content?: string,
  link?: string,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: BigInt(userId),
        type,
        title: title.slice(0, 200),
        content: content?.slice(0, 1000) ?? null,
        link: link?.slice(0, 255) ?? null,
      },
    });
  } catch (err) {
    logger.warn({ err }, '写入通知失败');
  }
}

export async function notifyMany(
  userIds: Array<bigint | number>,
  type: string,
  title: string,
  content?: string,
  link?: string,
): Promise<void> {
  for (const id of userIds) await notify(id, type, title, content, link);
}
