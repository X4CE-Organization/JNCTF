import { defineStore } from 'pinia';
import { api, setTokens } from '../api';

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  avatar: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  score: number;
  totpEnabled: boolean;
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  hasPassword?: boolean;
  bio?: string;
  website?: string;
  country?: string;
  organization?: string;
  teamId?: number | null;
  teamName?: string | null;
}

export interface MetaInfo {
  settings: Record<string, string>;
  categories: Array<{ id: number; name: string; slug: string; icon?: string; color?: string; description?: string }>;
  announcements: Array<{ id: number; title: string; content: string; level: string; pinned: boolean; publishedAt: string }>;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as SessionUser | null,
    meta: null as MetaInfo | null,
    loading: true,
  }),
  getters: {
    isLogin: (state) => Boolean(state.user),
    isAdmin: (state) => Boolean(state.user && state.user.role !== 'USER'),
    isSuperAdmin: (state) => state.user?.role === 'SUPER_ADMIN',
    siteName: (state) => String(state.meta?.settings['site.name'] ?? 'JNCTF'),
    siteLogo: (state) => String(state.meta?.settings['site.logo'] ?? ''),
    categories: (state) => state.meta?.categories ?? [],
    githubUrl: (state) => String(state.meta?.settings['site.github'] ?? ''),
  },
  actions: {
    async bootstrap() {
      this.loading = true;
      try {
        this.meta = await api.get<MetaInfo>('/api/site/meta').catch(() => this.meta);
        await this.refresh();
      } finally {
        this.loading = false;
      }
    },
    async refresh() {
      try {
        this.user = await api.get<SessionUser>('/api/auth/me');
      } catch {
        this.user = null;
      }
    },
    async login(username: string, password: string, totpCode?: string) {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: SessionUser }>('/api/auth/login', {
        username,
        password,
        totpCode,
      });
      setTokens(data.accessToken, data.refreshToken);
      this.user = data.user;
      return data.user;
    },
    async register(payload: {
      username: string;
      password: string;
      email?: string;
      phone?: string;
      phoneCode?: string;
      emailCode?: string;
      displayName?: string;
    }) {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: SessionUser }>('/api/auth/register', payload);
      setTokens(data.accessToken, data.refreshToken);
      this.user = data.user;
      return data.user;
    },
    /** 手机号 / 邮箱验证码登录 */
    async loginWithCode(kind: 'phone' | 'email', value: string, code: string) {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: SessionUser }>(
        `/api/auth/login/${kind}`,
        kind === 'phone' ? { phone: value, code } : { email: value, code },
      );
      setTokens(data.accessToken, data.refreshToken);
      this.user = data.user;
      return data.user;
    },
    async logout() {
      setTokens(null, null);
      this.user = null;
    },
    async reloadMeta() {
      this.meta = await api.get<MetaInfo>('/api/site/meta');
    },
  },
});
