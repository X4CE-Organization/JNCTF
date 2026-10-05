<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import {
  NAvatar, NBadge, NButton, NConfigProvider, NDialogProvider, NDropdown, NMessageProvider,
  NNotificationProvider, darkTheme, zhCN, dateZhCN,
} from 'naive-ui';
import { useAuthStore } from './stores/auth';
import { themeOverrides, darkThemeOverrides } from './theme';
import { api } from './api';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const dark = ref(false);
const unread = ref(0);
const scrolled = ref(false);
const mobileOpen = ref(false);

const NAV = [
  { to: '/moments', label: '动态' },
  { to: '/challenges', label: '题目' },
  { to: '/competitions', label: '比赛' },
  { to: '/discussions', label: '讨论' },
  { to: '/articles', label: '文章' },
  { to: '/shop', label: '商店' },
  { to: '/teams', label: '团队' },
  { to: '/scoreboard', label: '榜单' },
  { to: '/submissions', label: '提交' },
];

/** 维护模式：管理员照常访问，普通访客只看提示页（登录、回调页仍然放行） */
const OPEN_PATHS = ['/login', '/register', '/oauth/callback'];
const maintenance = computed(
  () =>
    auth.meta?.settings['site.maintenance'] === 'true' &&
    !auth.isAdmin &&
    !OPEN_PATHS.includes(route.path),
);

const userOptions = computed(() => [
  { label: '个人主页', key: 'profile' },
  { label: '创作中心', key: 'creation' },
  { label: '我的提交', key: 'submissions' },
  { label: '我的工单', key: 'tickets' },
  { label: `消息中心${unread.value ? `（${unread.value}）` : ''}`, key: 'notifications' },
  { label: '个人设置', key: 'settings' },
  ...(auth.isAdmin ? [{ label: '管理后台', key: 'admin' }] : []),
  { type: 'divider', key: 'd1' },
  { label: '退出登录', key: 'logout' },
]);

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`);
}

async function loadUnread() {
  if (!auth.isLogin) {
    unread.value = 0;
    return;
  }
  unread.value = await api
    .get<{ unread: number }>('/api/notifications/unread-count')
    .then((d) => d.unread)
    .catch(() => 0);
}

async function onUserSelect(key: string) {
  if (key === 'logout') {
    await auth.logout();
    router.push('/');
    return;
  }
  const map: Record<string, string> = {
    profile: `/users/${auth.user?.username}`,
    creation: '/creation',
    submissions: '/submissions?mine=1',
    tickets: '/tickets',
    notifications: '/notifications',
    settings: '/settings',
    admin: '/admin',
  };
  if (map[key]) router.push(map[key]);
}

onMounted(async () => {
  await auth.bootstrap();
  await loadUnread();
  document.title = auth.siteName;
  const customFavicon = String(auth.meta?.settings['site.favicon'] ?? '');
  if (customFavicon) {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) link.href = customFavicon;
  }
  const saved = localStorage.getItem('jnctf-theme');
  // 默认浅色主题，用户切过之后按记忆来
  dark.value = saved ? saved === 'dark' : false;
  document.documentElement.classList.toggle('dark', dark.value);

  window.addEventListener('scroll', () => {
    scrolled.value = window.scrollY > 8;
  }, { passive: true });

  setInterval(loadUnread, 60_000);
});

function toggleTheme() {
  dark.value = !dark.value;
  localStorage.setItem('jnctf-theme', dark.value ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', dark.value);
  // 图表等按 CSS 变量取色的组件，切换后需要重绘
  window.dispatchEvent(new Event('jnctf-theme'));
}
</script>

<template>
  <n-config-provider
    :theme="dark ? darkTheme : null"
    :theme-overrides="dark ? darkThemeOverrides : themeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <n-message-provider>
      <n-notification-provider>
        <n-dialog-provider>
          <div class="app-shell">
            <!-- 顶栏 -->
            <header class="app-header" :class="scrolled ? 'is-scrolled' : ''">
              <div class="app-header-inner">
                <RouterLink to="/" class="brand" @click="mobileOpen = false">
                  <img v-if="auth.siteLogo" :src="auth.siteLogo" class="brand-logo" alt="" />
                  <span v-else class="brand-mark">J</span>
                  <span class="brand-name">{{ auth.siteName }}</span>
                </RouterLink>

                <nav class="nav">
                  <RouterLink
                    v-for="item in NAV"
                    :key="item.to"
                    :to="item.to"
                    class="nav-item"
                    :class="isActive(item.to) ? 'is-active' : ''"
                  >
                    {{ item.label }}
                  </RouterLink>
                  <RouterLink v-if="auth.isAdmin" to="/admin" class="nav-item" :class="isActive('/admin') ? 'is-active' : ''">
                    后台
                  </RouterLink>
                </nav>

                <div class="header-actions">
                  <button class="icon-btn" :title="dark ? '切换到浅色' : '切换到深色'" @click="toggleTheme">
                    {{ dark ? '☀' : '☾' }}
                  </button>

                  <template v-if="auth.isLogin">
                    <RouterLink to="/notifications" class="icon-btn" title="消息中心">
                      <n-badge :value="unread" :max="99" :show="unread > 0" :offset="[4, -2]">
                        <span class="bell">🔔</span>
                      </n-badge>
                    </RouterLink>
                    <n-dropdown :options="userOptions" trigger="click" placement="bottom-end" @select="onUserSelect">
                      <button class="user-chip">
                        <n-avatar round :size="30" :src="auth.user?.avatar || undefined">
                          {{ (auth.user?.displayName || '?').slice(0, 1) }}
                        </n-avatar>
                        <span class="user-meta">
                          <span class="user-name">{{ auth.user?.displayName }}</span>
                          <span class="user-score">等级分 {{ auth.user?.score }} · 积分 {{ auth.user?.points }}</span>
                        </span>
                      </button>
                    </n-dropdown>
                  </template>
                  <template v-else>
                    <RouterLink to="/login" class="ghost-link">登录</RouterLink>
                    <RouterLink to="/register" class="cta-link">注册</RouterLink>
                  </template>

                  <button class="icon-btn only-mobile" title="菜单" @click="mobileOpen = !mobileOpen">☰</button>
                </div>
              </div>

              <nav v-if="mobileOpen" class="mobile-nav">
                <RouterLink v-for="item in NAV" :key="item.to" :to="item.to" class="mobile-nav-item" @click="mobileOpen = false">
                  {{ item.label }}
                </RouterLink>
              </nav>
            </header>

            <!-- 内容 -->
            <main class="app-main">
              <div v-if="maintenance" class="maintenance-page">
                <div class="mono maintenance-code">503</div>
                <h1>站点维护中</h1>
                <p>{{ auth.meta?.settings['site.maintenance_notice'] || '站点正在维护，请稍后再来' }}</p>
                <RouterLink to="/login" class="ghost-link">管理员登录</RouterLink>
              </div>
              <RouterView v-slot="{ Component }">
                <Transition v-if="!maintenance" name="fade" mode="out-in">
                  <component :is="Component" />
                </Transition>
              </RouterView>
            </main>

            <!-- 页脚 -->
            <footer class="app-footer">
              <div class="app-footer-inner">
                <a v-if="auth.githubUrl" :href="auth.githubUrl" target="_blank" rel="noreferrer">Powered by JNCTF</a>
                <span v-else>Powered by JNCTF</span>
                <span class="sep">·</span>
                <span>© 2026 X4CE</span>
                <template v-if="auth.meta?.settings['site.icp']">
                  <span class="sep">·</span>
                  <span>{{ auth.meta.settings['site.icp'] }}</span>
                </template>
              </div>
            </footer>
          </div>
        </n-dialog-provider>
      </n-notification-provider>
    </n-message-provider>
  </n-config-provider>
</template>
