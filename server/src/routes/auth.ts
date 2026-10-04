import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { accessTokenSeconds, issueAccessToken, issueRefreshToken, verifyToken, type RefreshPayload } from '../lib/jwt.js';
import { buildOtpAuthUrl, generateSecret, verifyTotp } from '../lib/totp.js';
import { getBool, getSetting } from '../lib/settings.js';
import { audit, clientIp, notify } from '../lib/audit.js';
import { sendMail } from '../lib/mail.js';
import { clearFailure, increaseFailure, rateLimit, readFailure, redis } from '../lib/redis.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';

export const authRouter = Router();

const USERNAME_RE = /^[a-zA-Z0-9_\u4e00-\u9fa5-]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_PREFIX = 'jnctf:reset:';

const registerSchema = z.object({
  username: z.string().trim().min(3, '至少 3 个字符').max(20, '最多 20 个字符'),
  password: z.string().min(8, '至少 8 位').max(64, '最多 64 位'),
  email: z.string().trim().email('邮箱格式不正确').optional().or(z.literal('')),
  displayName: z.string().trim().max(48).optional(),
});

const loginSchema = z.object({
  username: z.string().trim().min(1, '不能为空'),
  password: z.string().min(1, '不能为空'),
  totpCode: z.string().trim().optional(),
});

function userSummary(user: {
  id: bigint;
  username: string;
  displayName: string | null;
  avatar: string | null;
  role: string;
  status: string;
  score: number;
  totpEnabled: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatar: user.avatar ?? '',
    role: user.role,
    status: user.status,
    score: user.score,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt,
  };
}

function issueTokens(user: { id: bigint; username: string; role: string }) {
  return {
    accessToken: issueAccessToken(user.id, user.username, user.role),
    refreshToken: issueRefreshToken(user.id),
    expiresIn: accessTokenSeconds(),
  };
}

/* ---------------------------------------------------------------- 注册 */

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    if (!getBool('site.allow_register')) throw ApiError.forbidden('本站暂未开放注册');
    if (!USERNAME_RE.test(body.username)) {
      throw ApiError.badRequest('用户名只能包含中文、字母、数字、下划线和短横线，长度 3-20');
    }
    if (await prisma.user.findUnique({ where: { username: body.username } })) {
      throw ApiError.conflict('该用户名已被注册');
    }

    const email = body.email ? body.email.toLowerCase() : null;
    const needEmail = getSetting('site.registration_mode') !== 'none';
    if (needEmail && !email) throw ApiError.badRequest('本站注册需要填写邮箱');
    if (email) {
      if (!EMAIL_RE.test(email)) throw ApiError.badRequest('邮箱格式不正确');
      if (await prisma.user.findUnique({ where: { email } })) throw ApiError.conflict('该邮箱已被注册');
    }

    const needVerify = getBool('site.need_email_verify');
    const user = await prisma.user.create({
      data: {
        username: body.username,
        email,
        passwordHash: await bcrypt.hash(body.password, 10),
        displayName: body.displayName || body.username,
        status: needVerify ? 'PENDING' : 'ACTIVE',
        emailVerified: !needVerify,
      },
    });

    await notify(user.id, 'SYSTEM', `欢迎加入 ${getSetting('site.name')}`, '账号已创建，去看看有哪些题目吧', '/challenges');
    await audit(req, user, 'user.register', 'user', user.id);
    return ok(res, { ...issueTokens(user), user: userSummary(user) }, 201);
  }),
);

/* ---------------------------------------------------------------- 登录 */

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const ip = clientIp(req);
    const limit = Number(getSetting('security.login_fail_limit')) || 10;
    const lockMinutes = Number(getSetting('security.login_lock_minutes')) || 15;
    const lockKey = `login:${body.username}:${ip}`;
    // 只有「失败次数」超限才锁，正常登录多少次都不受影响
    if (limit > 0 && (await readFailure(lockKey)) >= limit) {
      throw ApiError.tooMany('登录失败次数过多，请稍后再试');
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ username: body.username }, { email: body.username.toLowerCase() }] },
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      await increaseFailure(lockKey, lockMinutes * 60);
      await prisma.loginLog.create({ data: { userId: user?.id ?? null, username: body.username, ip, userAgent: req.headers['user-agent'] ?? '', success: false } });
      throw ApiError.unauthorized('用户名或密码不正确');
    }
    if (user.banned || user.status === 'BANNED') {
      throw ApiError.forbidden(user.banReason || '账号已被封禁');
    }
    if (user.totpEnabled) {
      if (!body.totpCode) throw new ApiError(401, 'TOTP_REQUIRED', '请输入两步验证码');
      if (!verifyTotp(user.totpSecret, body.totpCode)) throw ApiError.unauthorized('两步验证码不正确');
    }

    await clearFailure(lockKey);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), lastLoginIp: ip } });
    await prisma.loginLog.create({ data: { userId: user.id, username: user.username, ip, userAgent: req.headers['user-agent'] ?? '', success: true } });
    await audit(req, user, 'user.login', 'user', user.id);

    return ok(res, { ...issueTokens(user), user: userSummary(user) });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = String(req.body?.refreshToken ?? '');
    const payload = verifyToken<RefreshPayload>(token);
    if (!payload || payload.typ !== 'refresh') throw ApiError.unauthorized('刷新令牌无效');
    const user = await prisma.user.findUnique({ where: { id: BigInt(payload.sub) } });
    if (!user || user.banned) throw ApiError.unauthorized('账号不可用');
    return ok(res, { ...issueTokens(user), user: userSummary(user) });
  }),
);

/* ------------------------------------------------------------ 当前用户 */

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      include: { teamMember: { include: { team: true } } },
    });
    if (!user) throw ApiError.notFound('账号不存在');
    return ok(res, {
      ...userSummary(user),
      email: user.email ?? '',
      bio: user.bio ?? '',
      website: user.website ?? '',
      country: user.country ?? '',
      organization: user.organization ?? '',
      locale: user.locale,
      teamId: user.teamMember?.teamId ?? null,
      teamName: user.teamMember?.team?.name ?? null,
    });
  }),
);

const profileSchema = z.object({
  displayName: z.string().trim().max(48).optional(),
  bio: z.string().max(512).optional(),
  website: z.string().max(128).optional(),
  country: z.string().max(64).optional(),
  organization: z.string().max(64).optional(),
  avatar: z.string().max(512).optional(),
  locale: z.string().max(8).optional(),
});

authRouter.put(
  '/profile',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const body = profileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: actor.id },
      data: {
        displayName: body.displayName || undefined,
        bio: body.bio,
        website: body.website,
        country: body.country,
        organization: body.organization,
        avatar: body.avatar,
        locale: body.locale,
      },
    });
    return ok(res, userSummary(user));
  }),
);

authRouter.put(
  '/password',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const current = String(req.body?.currentPassword ?? '');
    const next = String(req.body?.newPassword ?? '');
    if (next.length < 8) throw ApiError.badRequest('新密码至少 8 位');
    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
      throw ApiError.badRequest('当前密码不正确');
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
    await audit(req, user, 'user.change_password', 'user', user.id);
    return ok(res, { ok: true });
  }),
);

authRouter.get(
  '/check-username',
  asyncHandler(async (req, res) => {
    const username = String(req.query.username ?? '').trim();
    if (!username) return ok(res, { available: false, reason: '请输入用户名' });
    if (!USERNAME_RE.test(username)) return ok(res, { available: false, reason: '只能包含中文、字母、数字、下划线和短横线，长度 3-20' });
    const exists = await prisma.user.findUnique({ where: { username } });
    return ok(res, { available: !exists, reason: exists ? '该用户名已被占用' : '' });
  }),
);

authRouter.get(
  '/check-email',
  asyncHandler(async (req, res) => {
    const email = String(req.query.email ?? '').trim().toLowerCase();
    if (!email) return ok(res, { available: false, reason: '请输入邮箱' });
    if (!EMAIL_RE.test(email)) return ok(res, { available: false, reason: '邮箱格式不正确' });
    const exists = await prisma.user.findUnique({ where: { email } });
    return ok(res, { available: !exists, reason: exists ? '该邮箱已被注册' : '' });
  }),
);

/* ------------------------------------------------------------ 两步验证 */

authRouter.post(
  '/2fa/setup',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const secret = generateSecret();
    await prisma.user.update({ where: { id: actor.id }, data: { totpSecret: secret, totpEnabled: false } });
    return ok(res, { secret, otpauthUrl: buildOtpAuthUrl(secret, actor.username, getSetting('site.name')) });
  }),
);

authRouter.post(
  '/2fa/enable',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const code = String(req.body?.code ?? '');
    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user?.totpSecret) throw ApiError.badRequest('请先获取密钥');
    if (!verifyTotp(user.totpSecret, code)) throw ApiError.badRequest('验证码不正确');
    await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
    await audit(req, user, 'user.2fa_enable', 'user', user.id);
    return ok(res, { ok: true });
  }),
);

authRouter.post(
  '/2fa/disable',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!verifyTotp(user?.totpSecret, String(req.body?.code ?? ''))) throw ApiError.badRequest('验证码不正确');
    await prisma.user.update({ where: { id: actor.id }, data: { totpEnabled: false, totpSecret: null } });
    await audit(req, user, 'user.2fa_disable', 'user', actor.id);
    return ok(res, { ok: true });
  }),
);

/* -------------------------------------------------------------- 找回密码 */

authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const account = String(req.body?.account ?? '').trim();
    if (!(await rateLimit(`forgot:${clientIp(req)}`, 60))) throw ApiError.tooMany('请求过于频繁');
    const user = await prisma.user.findFirst({
      where: { OR: [{ username: account }, { email: account.toLowerCase() }] },
    });
    // 账号不存在也返回成功，避免被用来探测注册用户
    if (user?.email) {
      const token = crypto.randomBytes(24).toString('hex');
      await redis.set(`${RESET_PREFIX}${token}`, String(user.id), 'EX', 1800);
      const link = `${config.siteUrl}/reset-password?token=${token}`;
      await sendMail(
        user.email,
        `重置 ${getSetting('site.name')} 密码`,
        `你好 ${user.displayName || user.username}：\n\n点击链接重置密码（30 分钟内有效）：\n${link}\n\n如果不是你本人的操作，请忽略这封邮件。`,
      );
    }
    return ok(res, { ok: true });
  }),
);

authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token ?? '');
    const password = String(req.body?.newPassword ?? '');
    if (password.length < 8) throw ApiError.badRequest('新密码至少 8 位');
    const key = `${RESET_PREFIX}${token}`;
    const userId = await redis.get(key);
    if (!userId) throw ApiError.badRequest('链接无效或已过期');
    await prisma.user.update({ where: { id: BigInt(userId) }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    await redis.del(key);
    return ok(res, { ok: true });
  }),
);

/* ----------------------------------------------------------- API Token */

authRouter.get(
  '/tokens',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const tokens = await prisma.apiToken.findMany({ where: { userId: actor.id }, orderBy: { id: 'desc' } });
    return ok(res, tokens.map((t) => ({ id: t.id, name: t.name, prefix: t.prefix, lastUsedAt: t.lastUsedAt, expiresAt: t.expiresAt, revoked: t.revoked, createdAt: t.createdAt })));
  }),
);

authRouter.post(
  '/tokens',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    if (!getBool('security.allow_api_token')) throw ApiError.forbidden('本站已关闭 API 令牌');
    const name = String(req.body?.name ?? '').trim() || '未命名令牌';
    const raw = `jnctf_${crypto.randomBytes(24).toString('hex')}`;
    const record = await prisma.apiToken.create({
      data: {
        userId: actor.id,
        name: name.slice(0, 64),
        tokenHash: crypto.createHash('sha256').update(raw).digest('hex'),
        prefix: raw.slice(0, 12),
      },
    });
    await audit(req, actor, 'token.create', 'api_token', record.id);
    // 明文只在这里返回一次
    return ok(res, { id: record.id, name: record.name, token: raw }, 201);
  }),
);

authRouter.delete(
  '/tokens/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const id = BigInt(req.params.id!);
    const token = await prisma.apiToken.findUnique({ where: { id } });
    if (!token || (token.userId !== actor.id && actor.role !== 'SUPER_ADMIN')) throw ApiError.notFound('令牌不存在');
    await prisma.apiToken.update({ where: { id }, data: { revoked: true } });
    await audit(req, actor, 'token.revoke', 'api_token', id);
    return ok(res, { ok: true });
  }),
);

/* -------------------------------------------------------------- 登录记录 */

authRouter.get(
  '/login-logs',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const logs = await prisma.loginLog.findMany({ where: { userId: actor.id }, orderBy: { id: 'desc' }, take: 30 });
    const ips = new Set(logs.map((l) => l.ip).filter(Boolean));
    return ok(res, { items: logs, distinctIps: ips.size });
  }),
);
