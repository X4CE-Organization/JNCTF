import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { verifyToken, type AccessPayload } from '../lib/jwt.js';
import { ApiError } from '../lib/errors.js';

export interface AuthUser {
  id: bigint;
  username: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  banned: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * 解析身份，支持两种凭证：
 *   Authorization: Bearer <jwt>      浏览器
 *   Authorization: Token <api-token> 脚本 / CI
 * 解析失败不报错，交给后续的 requireAuth 决定。
 */
export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header) return next();
  try {
    if (/^token /i.test(header)) {
      const raw = header.slice(6).trim();
      if (!raw) return next();
      const record = await prisma.apiToken.findUnique({ where: { tokenHash: sha256(raw) } });
      if (!record || record.revoked) return next();
      if (record.expiresAt && record.expiresAt < new Date()) return next();
      const user = await prisma.user.findUnique({ where: { id: record.userId } });
      if (!user || user.banned) return next();
      req.user = { id: user.id, username: user.username, role: user.role, banned: user.banned };
      // lastUsedAt 不必每次写库，5 分钟更新一次
      if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 300_000) {
        await prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
      }
      return next();
    }

    if (/^bearer /i.test(header)) {
      const token = header.slice(7).trim();
      const payload = verifyToken<AccessPayload>(token);
      if (!payload || payload.typ !== 'access') return next();
      const user = await prisma.user.findUnique({ where: { id: BigInt(payload.sub) } });
      if (!user || user.banned) return next();
      req.user = { id: user.id, username: user.username, role: user.role, banned: user.banned };
    }
  } catch {
    /* 忽略，按未登录处理 */
  }
  next();
}

export function requireAuth(req: Request): AuthUser {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}

export function requireRole(req: Request, ...roles: Array<AuthUser['role']>): AuthUser {
  const user = requireAuth(req);
  if (!roles.includes(user.role)) throw ApiError.forbidden();
  return user;
}

export function requireAdmin(req: Request): AuthUser {
  return requireRole(req, 'ADMIN', 'SUPER_ADMIN');
}

export function requireSuperAdmin(req: Request): AuthUser {
  return requireRole(req, 'SUPER_ADMIN');
}

export function optionalUser(req: Request): AuthUser | undefined {
  return req.user;
}
