import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { issueAccessToken, issueRefreshToken, accessTokenSeconds } from '../lib/jwt.js';
import { getBool, getSetting } from '../lib/settings.js';
import { audit, clientIp, notify } from '../lib/audit.js';
import { kvSet, kvTake } from '../lib/kv.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { buildAuthorizeUrl, enabledProviders, fetchProfile, type ProviderId } from '../services/oauth.js';

export const oauthRouter = Router();

const STATE_PREFIX = 'jnctf:oauth:state:';
const TICKET_PREFIX = 'jnctf:oauth:ticket:';
const STATE_TTL = 600;
const TICKET_TTL = 180;

interface StatePayload {
  provider: ProviderId;
  redirect: string;
}

interface TicketPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const ALLOWED: ProviderId[] = ['github', 'google', 'gitee', 'custom'];

function providerParam(raw: string): ProviderId {
  if (!ALLOWED.includes(raw as ProviderId)) throw ApiError.notFound('不支持的登录方式');
  return raw as ProviderId;
}

function frontendUrl(path: string, params: Record<string, string>): string {
  const base = config.siteUrl.replace(/\/$/, '');
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function safeRedirect(raw: unknown): string {
  const value = String(raw ?? '').trim();
  // 只允许站内路径，避免被拿来做开放重定向
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value.slice(0, 200);
}

/** 登录页用：列出可用的第三方登录通道 */
oauthRouter.get(
  '/providers',
  asyncHandler(async (_req, res) => ok(res, { enabled: getBool('oauth.enabled'), items: enabledProviders() })),
);

/** 跳转到第三方授权页 */
oauthRouter.get(
  '/:provider/start',
  asyncHandler(async (req, res) => {
    const provider = providerParam(req.params.provider!);
    if (!getBool('oauth.enabled')) throw ApiError.forbidden('本站未开启第三方登录');
    if (!enabledProviders().some((p) => p.id === provider)) throw ApiError.badRequest('该登录方式未配置');

    const state = crypto.randomBytes(16).toString('hex');
    await kvSet(
      `${STATE_PREFIX}${state}`,
      { provider, redirect: safeRedirect(req.query.redirect) } satisfies StatePayload,
      STATE_TTL,
    );
    res.redirect(302, buildAuthorizeUrl(provider, state));
  }),
);

/** 第三方回调：校验 state -> 换用户信息 -> 找/建账号 -> 发一次性票据 -> 回前端 */
oauthRouter.get(
  '/:provider/callback',
  asyncHandler(async (req, res) => {
    const provider = providerParam(req.params.provider!);
    const state = String(req.query.state ?? '');
    const code = String(req.query.code ?? '');
    const failure = String(req.query.error_description ?? req.query.error ?? '');

    const saved = state ? await kvTake<StatePayload>(`${STATE_PREFIX}${state}`) : null;
    if (!saved || saved.provider !== provider) {
      return res.redirect(302, frontendUrl('/oauth/callback', { error: '登录会话已失效，请重试' }));
    }
    if (failure) return res.redirect(302, frontendUrl('/oauth/callback', { error: failure }));
    if (!code) return res.redirect(302, frontendUrl('/oauth/callback', { error: '没有拿到授权码' }));

    let profile;
    try {
      profile = await fetchProfile(provider, code);
    } catch (err) {
      const text = err instanceof Error ? err.message : '第三方登录失败';
      return res.redirect(302, frontendUrl('/oauth/callback', { error: text }));
    }

    const linked = await prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId: profile.providerUserId } },
      include: { user: true },
    });

    let user = linked?.user ?? null;
    let created = false;

    if (!user && profile.email && getBool('oauth.bind_by_email')) {
      const byEmail = await prisma.user.findUnique({ where: { email: profile.email.toLowerCase() } });
      if (byEmail) user = byEmail;
    }

    if (!user) {
      if (!getBool('oauth.auto_register')) {
        return res.redirect(302, frontendUrl('/oauth/callback', { error: '这个第三方账号还没有绑定站内账号，请先用密码登录后在设置里绑定' }));
      }
      user = await createUserFromProfile(provider, profile);
      created = true;
    }

    if (user.banned || user.status === 'BANNED') {
      return res.redirect(302, frontendUrl('/oauth/callback', { error: user.banReason || '账号已被封禁' }));
    }

    if (!linked || linked.userId !== user.id) {
      await prisma.oAuthAccount.upsert({
        where: { provider_providerUserId: { provider, providerUserId: profile.providerUserId } },
        create: {
          userId: user.id,
          provider,
          providerUserId: profile.providerUserId,
          providerName: profile.name,
          avatar: profile.avatar,
        },
        update: { userId: user.id, providerName: profile.name, avatar: profile.avatar, lastLoginAt: new Date() },
      });
    } else {
      await prisma.oAuthAccount.update({ where: { id: linked.id }, data: { lastLoginAt: new Date() } });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: clientIp(req) },
    });
    await prisma.loginLog.create({
      data: {
        userId: user.id,
        username: user.username,
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] ?? '',
        success: true,
      },
    });
    await audit(req, user, created ? 'user.oauth_register' : 'user.oauth_login', 'user', user.id, provider);
    if (created && getBool('site.welcome_notify')) {
      await notify(user.id, 'SYSTEM', `欢迎加入 ${getSetting('site.name')}`, '账号已通过第三方登录创建', '/challenges');
    }

    const ticket = crypto.randomBytes(24).toString('hex');
    await kvSet(
      `${TICKET_PREFIX}${ticket}`,
      {
        accessToken: issueAccessToken(user.id, user.username, user.role),
        refreshToken: issueRefreshToken(user.id),
        expiresIn: accessTokenSeconds(),
      } satisfies TicketPayload,
      TICKET_TTL,
    );

    const redirect = saved.redirect && saved.redirect !== '/' ? saved.redirect : '/';
    return res.redirect(302, frontendUrl('/oauth/callback', { ticket, redirect }));
  }),
);

/** 前端拿到票据后换成正式令牌（避免 token 出现在 URL 里） */
oauthRouter.post(
  '/exchange',
  asyncHandler(async (req, res) => {
    const ticket = String(req.body?.ticket ?? '');
    if (!ticket) throw ApiError.badRequest('缺少票据');
    const payload = await kvTake<TicketPayload>(`${TICKET_PREFIX}${ticket}`);
    if (!payload) throw ApiError.badRequest('票据无效或已过期');
    const parts = payload.accessToken.split('.');
    const subject = parts.length === 3 ? JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()) : null;
    const user = subject?.sub ? await prisma.user.findUnique({ where: { id: BigInt(subject.sub) } }) : null;
    if (!user) throw ApiError.unauthorized('账号不存在');
    return ok(res, {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresIn: payload.expiresIn,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        avatar: user.avatar ?? '',
        role: user.role,
        status: user.status,
        score: user.score,
        totpEnabled: user.totpEnabled,
        createdAt: user.createdAt,
      },
    });
  }),
);

/** 登录后绑定第三方账号：生成 state 并把「绑定」意图带过去 */
oauthRouter.get(
  '/:provider/bind',
  asyncHandler(async (req, res) => {
    const provider = providerParam(req.params.provider!);
    if (!enabledProviders().some((p) => p.id === provider)) throw ApiError.badRequest('该登录方式未配置');
    const state = crypto.randomBytes(16).toString('hex');
    await kvSet(
      `${STATE_PREFIX}${state}`,
      { provider, redirect: safeRedirect(req.query.redirect) } satisfies StatePayload,
      STATE_TTL,
    );
    res.redirect(302, buildAuthorizeUrl(provider, state));
  }),
);

/** 解绑第三方账号 */
oauthRouter.delete(
  '/:provider',
  asyncHandler(async (req, res) => {
    const provider = providerParam(req.params.provider!);
    const actor = requireAuth(req);
    await prisma.oAuthAccount.deleteMany({ where: { userId: actor.id, provider } });
    await audit(req, actor, 'user.oauth_unbind', 'user', actor.id, provider);
    return ok(res, { ok: true });
  }),
);

/** 从第三方资料建站内账号，用户名冲突就自动加后缀 */
async function createUserFromProfile(provider: ProviderId, profile: { name: string; avatar: string; email: string }) {
  const base = (profile.name || provider)
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '')
    .slice(0, 16) || `${provider}user`;
  let username = base;
  for (let i = 0; i < 50; i += 1) {
    const exists = await prisma.user.findUnique({ where: { username } });
    if (!exists) break;
    username = `${base}${crypto.randomInt(1000, 9999)}`.slice(0, 20);
  }

  const email = profile.email ? profile.email.toLowerCase() : null;
  const emailTaken = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const role: 'USER' | 'ADMIN' = getSetting('oauth.default_role') === 'ADMIN' ? 'ADMIN' : 'USER';

  return prisma.user.create({
    data: {
      username,
      email: emailTaken ? null : email,
      // 第三方登录没有密码，放一个随机串占位，用户可以在设置里改密码
      passwordHash: crypto.randomBytes(32).toString('hex'),
      displayName: profile.name.slice(0, 48) || username,
      avatar: profile.avatar || null,
      emailVerified: Boolean(email) && !emailTaken,
      role,
    },
  });
}
