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
import { sendSms } from '../lib/sms.js';
import { consumeCode, issueCode, type CodeScene } from '../lib/verify-code.js';
import { clearFailure, increaseFailure, rateLimit, readFailure, redis } from '../lib/redis.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';

export const authRouter = Router();

const USERNAME_RE = /^[a-zA-Z0-9_\u4e00-\u9fa5-]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_PREFIX = 'jnctf:reset:';
const DEFAULT_PHONE_RE = '^1[3-9]\\d{9}$';

/** 手机号规则可以在后台改，非法正则时退回国内手机号 */
function phoneRegex(): RegExp {
  try {
    return new RegExp(getSetting('sms.phone_regex') || DEFAULT_PHONE_RE);
  } catch {
    return new RegExp(DEFAULT_PHONE_RE);
  }
}

function normalizePhone(raw: unknown): string {
  return String(raw ?? '').replace(/[\s-]/g, '');
}

function codeScene(raw: unknown, fallback: CodeScene): CodeScene {
  const value = String(raw ?? '').trim();
  return (['register', 'login', 'bind', 'reset'] as const).includes(value as CodeScene)
    ? (value as CodeScene)
    : fallback;
}

const registerSchema = z.object({
  username: z.string().trim().min(3, '至少 3 个字符').max(20, '最多 20 个字符'),
  password: z.string().min(8, '至少 8 位').max(64, '最多 64 位'),
  email: z.string().trim().email('邮箱格式不正确').optional().or(z.literal('')),
  phone: z.string().trim().max(32).optional().or(z.literal('')),
  phoneCode: z.string().trim().max(12).optional(),
  emailCode: z.string().trim().max(12).optional(),
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
  email?: string | null;
  phone?: string | null;
  role: string;
  status: string;
  score: number;
  totpEnabled: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatar: user.avatar ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    role: user.role,
    status: user.status,
    score: user.score,
    totpEnabled: user.totpEnabled,
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: Boolean(user.phoneVerified),
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
    const phone = body.phone ? normalizePhone(body.phone) : null;
    const needEmail = getBool('site.register_require_email') || getSetting('site.registration_mode') === 'email';
    const needPhone = getBool('site.register_require_phone');
    if (needEmail && !email) throw ApiError.badRequest('本站注册需要填写邮箱');
    if (needPhone && !phone) throw ApiError.badRequest('本站注册需要填写手机号');
    if (email) {
      if (!EMAIL_RE.test(email)) throw ApiError.badRequest('邮箱格式不正确');
      if (await prisma.user.findUnique({ where: { email } })) throw ApiError.conflict('该邮箱已被注册');
    }
    if (phone) {
      if (!phoneRegex().test(phone)) throw ApiError.badRequest('手机号格式不正确');
      if (await prisma.user.findUnique({ where: { phone } })) throw ApiError.conflict('该手机号已被注册');
      if (getBool('site.need_phone_verify')) {
        if (!(await consumeCode('phone', 'register', phone, String(body.phoneCode ?? '')))) {
          throw ApiError.badRequest('手机验证码不正确或已过期');
        }
      }
    }
    if (email && getBool('site.need_email_verify')) {
      if (!(await consumeCode('email', 'register', email, String(body.emailCode ?? '')))) {
        throw ApiError.badRequest('邮箱验证码不正确或已过期');
      }
    }

    const needVerify = getBool('site.need_email_verify') || getBool('site.need_phone_verify');
    const user = await prisma.user.create({
      data: {
        username: body.username,
        email,
        phone,
        passwordHash: await bcrypt.hash(body.password, 10),
        displayName: body.displayName || body.username,
        status: needVerify ? 'PENDING' : 'ACTIVE',
        emailVerified: Boolean(email) && !getBool('site.need_email_verify'),
        phoneVerified: Boolean(phone) && !getBool('site.need_phone_verify'),
      },
    });

    if (getBool('site.welcome_notify')) {
      await notify(user.id, 'SYSTEM', `欢迎加入 ${getSetting('site.name')}`, '账号已创建，去看看有哪些题目吧', '/challenges');
    }
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
      where: {
        OR: [
          { username: body.username },
          ...(getBool('site.allow_email_login') ? [{ email: body.username.toLowerCase() }] : []),
          ...(getBool('site.allow_phone_login') ? [{ phone: normalizePhone(body.username) }] : []),
        ],
      },
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
      bio: user.bio ?? '',
      website: user.website ?? '',
      country: user.country ?? '',
      organization: user.organization ?? '',
      locale: user.locale,
      teamId: user.teamMember?.teamId ?? null,
      teamName: user.teamMember?.team?.name ?? null,
      // 第三方登录创建的账号没有真实密码，前端据此提示「去设置密码」
      hasPassword: user.passwordHash.startsWith('$2'),
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
    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user) throw ApiError.notFound('账号不存在');
    const min = Math.max(6, Number(getSetting('password.min_length')) || 8);
    if (next.length < min) throw ApiError.badRequest(`新密码至少 ${min} 位`);
    // 第三方登录创建、还没设过密码的账号，允许直接设置
    const hasRealPassword = user.passwordHash.startsWith('$2');
    if (hasRealPassword && !(await bcrypt.compare(current, user.passwordHash))) {
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

/* ==================================================== 邮箱 / 手机号验证码 */

/**
 * 发验证码。scene 决定用途：
 *   register 注册  login 免密登录  bind 绑定到已有账号  reset 找回密码
 */
authRouter.post(
  '/code/email',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const scene = codeScene(req.body?.scene, 'bind');
    if (!EMAIL_RE.test(email)) throw ApiError.badRequest('邮箱格式不正确');
    if (!(await rateLimit(`code:email:${clientIp(req)}`, 10))) throw ApiError.tooMany('请求过于频繁');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (scene === 'register' && existing) throw ApiError.conflict('该邮箱已被注册');
    if ((scene === 'login' || scene === 'reset') && !existing) {
      // 不暴露账号是否存在，直接返回成功
      return ok(res, { ok: true, sent: true });
    }

    const issued = await issueCode('email', scene, email);
    if (!issued.ok || !issued.code) throw ApiError.tooMany(issued.reason || '发送过于频繁');

    const siteName = getSetting('site.name');
    await sendMail(
      email,
      `【${siteName}】${getSetting('mail.verify_subject') || '邮箱验证码'}`,
      `你的验证码是 ${issued.code}，${Math.floor((Number(getSetting('security.code_ttl_seconds')) || 300) / 60)} 分钟内有效。\n\n如果不是你本人的操作，请忽略这封邮件。`,
    );
    const debug = getBool('mail.debug') || !getBool('mail.enabled');
    if (!getBool('mail.enabled') && !debug) throw ApiError.badRequest('本站未开启邮件服务，无法发送验证码');
    return ok(res, { ok: true, sent: true, ...(debug && !getBool('mail.enabled') ? { devCode: issued.code } : {}) });
  }),
);

authRouter.post(
  '/code/phone',
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    const scene = codeScene(req.body?.scene, 'bind');
    if (!phoneRegex().test(phone)) throw ApiError.badRequest('手机号格式不正确');
    if (!(await rateLimit(`code:phone:${clientIp(req)}`, 10))) throw ApiError.tooMany('请求过于频繁');

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (scene === 'register' && existing) throw ApiError.conflict('该手机号已被注册');
    if ((scene === 'login' || scene === 'reset') && !existing) return ok(res, { ok: true, sent: true });

    const issued = await issueCode('phone', scene, phone);
    if (!issued.ok || !issued.code) throw ApiError.tooMany(issued.reason || '发送过于频繁');

    const result = await sendSms(phone, issued.code);
    if (!result.ok && !result.debugCode) throw ApiError.badRequest(result.error || '短信发送失败');
    return ok(res, { ok: true, sent: true, ...(result.debugCode ? { devCode: result.debugCode } : {}) });
  }),
);

/* ==================================================== 免密 / 手机号登录 */

authRouter.post(
  '/login/phone',
  asyncHandler(async (req, res) => {
    if (!getBool('site.allow_phone_login')) throw ApiError.forbidden('本站已关闭手机号登录');
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code ?? '');
    if (!phoneRegex().test(phone)) throw ApiError.badRequest('手机号格式不正确');
    if (!(await consumeCode('phone', 'login', phone, code))) throw ApiError.badRequest('验证码不正确或已过期');
    return ok(res, await loginByAccount(req, { phone }));
  }),
);

authRouter.post(
  '/login/email',
  asyncHandler(async (req, res) => {
    if (!getBool('site.allow_email_login')) throw ApiError.forbidden('本站已关闭邮箱验证码登录');
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const code = String(req.body?.code ?? '');
    if (!EMAIL_RE.test(email)) throw ApiError.badRequest('邮箱格式不正确');
    if (!(await consumeCode('email', 'login', email, code))) throw ApiError.badRequest('验证码不正确或已过期');
    return ok(res, await loginByAccount(req, { email }));
  }),
);

/** 验证码登录共用：找账号 -> 检查封禁 -> 记日志 -> 发令牌 */
async function loginByAccount(req: any, where: { phone: string } | { email: string }) {
  const user = await prisma.user.findFirst({ where });
  if (!user) throw ApiError.notFound('账号不存在，请先注册');
  if (user.banned || user.status === 'BANNED') throw ApiError.forbidden(user.banReason || '账号已被封禁');
  const ip = clientIp(req);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip, ...('phone' in where ? { phoneVerified: true } : { emailVerified: true }) },
  });
  await prisma.loginLog.create({
    data: { userId: user.id, username: user.username, ip, userAgent: req.headers['user-agent'] ?? '', success: true },
  });
  await audit(req, user, 'user.login', 'user', user.id, 'code');
  return { ...issueTokens(user), user: userSummary(user) };
}

/* ====================================================== 绑定 / 解绑 / 验证 */

authRouter.post(
  '/bind/phone',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code ?? '');
    if (!phoneRegex().test(phone)) throw ApiError.badRequest('手机号格式不正确');
    const taken = await prisma.user.findUnique({ where: { phone } });
    if (taken && taken.id !== actor.id) throw ApiError.conflict('该手机号已被其他账号绑定');
    if (!(await consumeCode('phone', 'bind', phone, code))) throw ApiError.badRequest('验证码不正确或已过期');
    const user = await prisma.user.update({ where: { id: actor.id }, data: { phone, phoneVerified: true } });
    await audit(req, user, 'user.bind_phone', 'user', user.id);
    return ok(res, userSummary(user));
  }),
);

authRouter.post(
  '/bind/email',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const code = String(req.body?.code ?? '');
    if (!EMAIL_RE.test(email)) throw ApiError.badRequest('邮箱格式不正确');
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken && taken.id !== actor.id) throw ApiError.conflict('该邮箱已被其他账号绑定');
    if (!(await consumeCode('email', 'bind', email, code))) throw ApiError.badRequest('验证码不正确或已过期');
    const user = await prisma.user.update({ where: { id: actor.id }, data: { email, emailVerified: true } });
    await audit(req, user, 'user.bind_email', 'user', user.id);
    return ok(res, userSummary(user));
  }),
);

authRouter.post(
  '/unbind/phone',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const user = await prisma.user.update({ where: { id: actor.id }, data: { phone: null, phoneVerified: false } });
    await audit(req, user, 'user.unbind_phone', 'user', user.id);
    return ok(res, userSummary(user));
  }),
);

authRouter.post(
  '/unbind/email',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const user = await prisma.user.update({ where: { id: actor.id }, data: { email: null, emailVerified: false } });
    await audit(req, user, 'user.unbind_email', 'user', user.id);
    return ok(res, userSummary(user));
  }),
);

/** 待验证账号用验证码激活 */
authRouter.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code ?? '');
    const user = email
      ? await prisma.user.findUnique({ where: { email } })
      : phone
        ? await prisma.user.findUnique({ where: { phone } })
        : null;
    if (!user) throw ApiError.notFound('账号不存在');
    const okCode = email
      ? await consumeCode('email', 'register', email, code)
      : await consumeCode('phone', 'register', phone, code);
    if (!okCode) throw ApiError.badRequest('验证码不正确或已过期');
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', ...(email ? { emailVerified: true } : { phoneVerified: true }) },
    });
    return ok(res, userSummary(updated));
  }),
);

/* --------------------------------------------------- 已绑定的第三方账号 */

authRouter.get(
  '/oauth-bindings',
  asyncHandler(async (req, res) => {
    const actor = requireAuth(req);
    const rows = await prisma.oAuthAccount.findMany({ where: { userId: actor.id }, orderBy: { id: 'asc' } });
    return ok(res, {
      items: rows.map((r) => ({
        provider: r.provider,
        providerName: r.providerName,
        avatar: r.avatar,
        boundAt: r.createdAt,
        lastLoginAt: r.lastLoginAt,
      })),
    });
  }),
);
