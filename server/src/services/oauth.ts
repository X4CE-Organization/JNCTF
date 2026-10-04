import { config } from '../config.js';
import { getBool, getSetting, getSettingOr } from '../lib/settings.js';
import { logger } from '../lib/logger.js';

/**
 * 通用 OAuth2 授权码流程。内置 GitHub / Google / Gitee 三个预设，
 * 另有一个「自定义」通道，任意标准 OAuth2 服务商填四个地址就能接。
 */
export type ProviderId = 'github' | 'google' | 'gitee' | 'custom';

interface ProviderPreset {
  id: ProviderId;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scope: string;
  idField: string;
  nameField: string;
  avatarField: string;
  emailField: string;
  secretKeys: { clientId: string; clientSecret: string };
  userAgent?: string;
}

const PRESETS: Record<Exclude<ProviderId, 'custom'>, ProviderPreset> = {
  github: {
    id: 'github',
    label: 'GitHub',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userinfoUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
    idField: 'id',
    nameField: 'login',
    avatarField: 'avatar_url',
    emailField: 'email',
    secretKeys: { clientId: 'oauth.github.client_id', clientSecret: 'oauth.github.client_secret' },
    userAgent: 'JNCTF',
  },
  google: {
    id: 'google',
    label: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: 'openid email profile',
    idField: 'sub',
    nameField: 'name',
    avatarField: 'picture',
    emailField: 'email',
    secretKeys: { clientId: 'oauth.google.client_id', clientSecret: 'oauth.google.client_secret' },
  },
  gitee: {
    id: 'gitee',
    label: 'Gitee',
    authorizeUrl: 'https://gitee.com/oauth/authorize',
    tokenUrl: 'https://gitee.com/oauth/token',
    userinfoUrl: 'https://gitee.com/api/v5/user',
    scope: 'user_info',
    idField: 'id',
    nameField: 'name',
    avatarField: 'avatar_url',
    emailField: 'email',
    secretKeys: { clientId: 'oauth.gitee.client_id', clientSecret: 'oauth.gitee.client_secret' },
  },
};

const CUSTOM: ProviderPreset = {
  id: 'custom',
  label: '自定义',
  authorizeUrl: '',
  tokenUrl: '',
  userinfoUrl: '',
  scope: '',
  idField: 'id',
  nameField: 'name',
  avatarField: 'avatar',
  emailField: 'email',
  secretKeys: { clientId: 'oauth.custom.client_id', clientSecret: 'oauth.custom.client_secret' },
};

function preset(id: ProviderId): ProviderPreset {
  if (id === 'custom') {
    return {
      ...CUSTOM,
      label: getSetting('oauth.custom.name') || '自定义',
      authorizeUrl: getSetting('oauth.custom.authorize_url').trim(),
      tokenUrl: getSetting('oauth.custom.token_url').trim(),
      userinfoUrl: getSetting('oauth.custom.userinfo_url').trim(),
      scope: getSetting('oauth.custom.scope').trim(),
      idField: getSetting('oauth.custom.id_field').trim() || 'id',
      nameField: getSetting('oauth.custom.name_field').trim() || 'name',
      avatarField: getSetting('oauth.custom.avatar_field').trim() || 'avatar',
      emailField: getSetting('oauth.custom.email_field').trim() || 'email',
    };
  }
  return PRESETS[id];
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  ready: boolean;
}

const ALL: ProviderId[] = ['github', 'google', 'gitee', 'custom'];

/** 前台登录页用：只暴露「启用了并且配好了」的通道 */
export function enabledProviders(): ProviderInfo[] {
  if (!getBool('oauth.enabled')) return [];
  return ALL.map((id) => {
    const p = preset(id);
    const ready = Boolean(
      getBool(`oauth.${id}.enabled`) &&
        getSetting(p.secretKeys.clientId).trim() &&
        getSetting(p.secretKeys.clientSecret).trim() &&
        p.authorizeUrl &&
        p.tokenUrl &&
        p.userinfoUrl,
    );
    return { id, label: p.label, ready };
  }).filter((p) => p.ready);
}

/** 回调地址。可用 `oauth.callback_base` 覆盖，用于反向代理场景 */
export function callbackUrl(id: ProviderId): string {
  const base = getSettingOr('oauth.callback_base', config.siteUrl).replace(/\/$/, '');
  return `${base}/api/auth/oauth/${id}/callback`;
}

export function buildAuthorizeUrl(id: ProviderId, state: string): string {
  const p = preset(id);
  const params = new URLSearchParams({
    client_id: getSetting(p.secretKeys.clientId),
    redirect_uri: callbackUrl(id),
    response_type: 'code',
    scope: p.scope,
    state,
  });
  return `${p.authorizeUrl}?${params.toString()}`;
}

export interface OAuthProfile {
  providerUserId: string;
  name: string;
  avatar: string;
  email: string;
}

function pick(data: any, path: string): string {
  if (!path) return '';
  const value = path.split('.').reduce<any>((acc, key) => (acc == null ? acc : acc[key]), data);
  return value === null || value === undefined ? '' : String(value);
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`返回的不是 JSON：${text.slice(0, 200)}`);
  }
}

/** 用授权码换用户信息 */
export async function fetchProfile(id: ProviderId, code: string): Promise<OAuthProfile> {
  const p = preset(id);
  const clientId = getSetting(p.secretKeys.clientId);
  const clientSecret = getSetting(p.secretKeys.clientSecret);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (p.userAgent) headers['User-Agent'] = p.userAgent;

  const tokenResponse = await fetchJson(p.tokenUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl(id),
    }),
  });
  const accessToken = tokenResponse?.access_token;
  if (!accessToken) {
    logger.warn({ id, tokenResponse }, 'OAuth 换取令牌失败');
    throw new Error(tokenResponse?.error_description || tokenResponse?.error || '换取访问令牌失败');
  }

  const userHeaders: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${accessToken}` };
  if (p.userAgent) userHeaders['User-Agent'] = p.userAgent;
  const info = await fetchJson(p.userinfoUrl, { headers: userHeaders });

  let email = pick(info, p.emailField);
  // GitHub 默认不返回邮箱，单独再要一次
  if (!email && id === 'github') {
    const emails = await fetchJson('https://api.github.com/user/emails', { headers: userHeaders }).catch(() => null);
    if (Array.isArray(emails)) {
      email = String(emails.find((e: any) => e.primary)?.email ?? emails[0]?.email ?? '');
    }
  }

  const providerUserId = pick(info, p.idField);
  if (!providerUserId) throw new Error('第三方账号没有返回唯一标识');
  return {
    providerUserId,
    name: pick(info, p.nameField) || providerUserId,
    avatar: pick(info, p.avatarField),
    email,
  };
}
