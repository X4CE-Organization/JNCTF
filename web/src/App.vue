<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import {
  NAvatar, NBadge, NButton, NConfigProvider, NDialogProvider, NDropdown, NLayout, NLayoutContent,
  NLayoutHeader, NMenu, NMessageProvider, NNotificationProvider, NSpace, darkTheme, zhCN, dateZhCN,
} from 'naive-ui';
import type { MenuOption } from 'naive-ui';
import { h } from 'vue';
import { useAuthStore } from './stores/auth';
import { themeOverrides } from './theme';
import { api } from './api';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const dark = ref(false);
const unread = ref(0);

const menuOptions = computed<MenuOption[]>(() => {
  const items: MenuOption[] = [
    { label: '首页', key: '/' },
    { label: '题目', key: '/challenges' },
    { label: '比赛', key: '/competitions' },
    { label: '榜单', key: '/scoreboard' },
    { label: '团队', key: '/teams' },
    { label: '题解', key: '/writeups' },
  ];
  if (auth.isAdmin) items.push({ label: '管理后台', key: '/admin' });
  return items;
});

const userOptions = computed(() => [
  { label: '个人主页', key: 'profile' },
  { label: '题解', key: 'writeups' },
  { label: '工单', key: 'tickets' },
  { label: `消息${unread.value ? `（${unread.value}）` : ''}`, key: 'notifications' },
  { label: '设置', key: 'settings' },
  { type: 'divider', key: 'd1' },
  { label: '退出登录', key: 'logout' },
]);

async function loadUnread() {
  if (!auth.isLogin) {
    unread.value = 0;
    return;
  }
  unread.value = await api
    .get<{ unread: number }>('/api/notifications/unread-count')
    .then((data) => data.unread)
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
    writeups: '/writeups?mine=1',
    tickets: '/tickets',
    notifications: '/notifications',
    settings: '/settings',
  };
  if (map[key]) router.push(map[key]);
}

onMounted(async () => {
  await auth.bootstrap();
  await loadUnread();
  dark.value = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  setInterval(loadUnread, 60_000);
});
</script>

<template>
  <n-config-provider :theme="dark ? darkTheme : null" :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <n-notification-provider>
        <n-dialog-provider>
          <n-layout class="min-h-screen">
            <n-layout-header bordered class="sticky top-0 z-40 backdrop-blur">
              <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
                <RouterLink to="/" class="flex items-center gap-2.5">
                  <img v-if="auth.siteLogo" :src="auth.siteLogo" class="h-8 w-8 rounded-lg object-cover" alt="" />
                  <span v-else class="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 text-sm font-black text-white">
                    J
                  </span>
                  <span class="text-lg font-bold tracking-tight">{{ auth.siteName }}</span>
                </RouterLink>

                <n-menu
                  mode="horizontal"
                  :options="menuOptions"
                  :value="route.path"
                  class="flex-1"
                  @update:value="(key: string) => router.push(key)"
                />

                <n-space align="center" :size="12">
                  <n-button quaternary circle @click="dark = !dark">
                    {{ dark ? '☀' : '☾' }}
                  </n-button>
                  <template v-if="auth.isLogin">
                    <RouterLink to="/notifications">
                      <n-badge :value="unread" :max="99" :show="unread > 0">
                        <n-button quaternary circle>🔔</n-button>
                      </n-badge>
                    </RouterLink>
                    <n-dropdown :options="userOptions" trigger="click" @select="onUserSelect">
                      <div class="flex cursor-pointer items-center gap-2">
                        <n-avatar round :size="32" :src="auth.user?.avatar || undefined">
                          {{ (auth.user?.displayName || '?').slice(0, 1) }}
                        </n-avatar>
                        <div class="hidden text-sm leading-tight sm:block">
                          <div class="font-medium">{{ auth.user?.displayName }}</div>
                          <div class="text-xs opacity-60">{{ auth.user?.score }} 分</div>
                        </div>
                      </div>
                    </n-dropdown>
                  </template>
                  <template v-else>
                    <n-button quaternary @click="router.push('/login')">登录</n-button>
                    <n-button type="primary" @click="router.push('/register')">注册</n-button>
                  </template>
                </n-space>
              </div>
            </n-layout-header>

            <n-layout-content class="mx-auto max-w-7xl px-4 py-6">
              <RouterView />
            </n-layout-content>

            <footer class="border-t py-8 text-center text-xs opacity-60">
              <div class="mx-auto max-w-7xl px-4">
                <a v-if="auth.githubUrl" :href="auth.githubUrl" target="_blank" rel="noreferrer" class="hover:underline">
                  Powered by JNCTF
                </a>
                <span v-else>Powered by JNCTF</span>
                <span class="mx-2">·</span>
                <span>{{ auth.meta?.settings['site.description'] }}</span>
              </div>
            </footer>
          </n-layout>
        </n-dialog-provider>
      </n-notification-provider>
    </n-message-provider>
  </n-config-provider>
</template>
