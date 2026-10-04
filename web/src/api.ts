/**
 * 统一的接口封装。
 *
 * - 自动带上 Bearer 令牌
 * - 访问令牌过期时自动用刷新令牌换新的，并把原请求重放一次
 * - 后端统一返回 { success, data, error }，这里直接返回 data，出错就抛
 */
const TOKEN_KEY = 'jnctf-token';
const REFRESH_KEY = 'jnctf-refresh';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; detail?: unknown };
  timestamp: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(status: number, code: string, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access: string | null, refresh?: string | null): void {
  try {
    if (access) localStorage.setItem(TOKEN_KEY, access);
    else localStorage.removeItem(TOKEN_KEY);
    if (refresh !== undefined) {
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
      else localStorage.removeItem(REFRESH_KEY);
    }
  } catch {
    /* localStorage 不可用时忽略 */
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
  if (refreshing) return refreshing;
  const refresh = getRefreshToken();
  if (!refresh) return false;
  refreshing = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!response.ok) return false;
      const payload = (await response.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string }>;
      if (!payload.success) return false;
      setTokens(payload.data.accessToken, payload.data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request<T>(method: string, url: string, body?: unknown, retry = true): Promise<T> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  const response = await fetch(url, { method, headers, body: payload, credentials: 'include' });

  if (response.status === 401 && retry && (await refreshToken())) {
    return request<T>(method, url, body, false);
  }

  const text = await response.text();
  let parsed: ApiEnvelope<T> | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok || !parsed?.success) {
    const error = parsed?.error;
    if (response.status === 401) setTokens(null, null);
    throw new ApiError(response.status, error?.code ?? 'ERROR', error?.message ?? `请求失败（${response.status}）`, error?.detail);
  }
  return parsed.data;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  del: <T>(url: string, body?: unknown) => request<T>('DELETE', url, body),
  upload: <T>(url: string, file: File | File[], field = 'file') => {
    const form = new FormData();
    if (Array.isArray(file)) file.forEach((f) => form.append(field, f));
    else form.append(field, file);
    return request<T>('POST', url, form);
  },
};

export function query(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
