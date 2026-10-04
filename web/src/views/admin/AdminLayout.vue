<script setup lang="ts">
import { computed } from 'vue';
import { NTag } from 'naive-ui';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const route = useRoute();

interface AdminTab {
  label: string;
  to: string;
  super?: boolean;
  match: (path: string) => boolean;
}

const tabs: AdminTab[] = [
  { label: '总览', to: '/admin', match: (p) => p === '/admin' },
  { label: '用户', to: '/admin/users', match: (p) => p.startsWith('/admin/users') },
  { label: '题目', to: '/admin/challenges', match: (p) => p.startsWith('/admin/challenges') },
  { label: '比赛', to: '/admin/competitions', match: (p) => p.startsWith('/admin/competitions') || p.startsWith('/admin/awx') },
  { label: '题解', to: '/admin/writeups', match: (p) => p.startsWith('/admin/writeups') },
  { label: '工单', to: '/admin/tickets', match: (p) => p.startsWith('/admin/tickets') },
  { label: '公告', to: '/admin/announcements', match: (p) => p.startsWith('/admin/announcements') },
  { label: '日志', to: '/admin/logs', super: true, match: (p) => p.startsWith('/admin/logs') },
  { label: '系统设置', to: '/admin/settings', super: true, match: (p) => p.startsWith('/admin/settings') },
];

const visibleTabs = computed(() => tabs.filter((t) => !t.super || auth.isSuperAdmin));
const current = computed(() => visibleTabs.value.find((t) => t.match(route.path))?.label ?? '控制台');
</script>

<template>
  <div class="admin-shell">
    <div class="admin-bar">
      <div class="admin-bar-lead">
        <span class="admin-bar-title">管理控制台</span>
        <n-tag size="small" :type="auth.isSuperAdmin ? 'error' : 'warning'" :bordered="false">
          {{ auth.isSuperAdmin ? '超级管理员' : '管理员' }}
        </n-tag>
        <span class="admin-bar-user mono">@{{ auth.user?.username }}</span>
      </div>

      <nav class="admin-tabs">
        <RouterLink
          v-for="tab in visibleTabs"
          :key="tab.to"
          :to="tab.to"
          class="admin-tab"
          :class="tab.match(route.path) ? 'is-active' : ''"
        >
          {{ tab.label }}
        </RouterLink>
      </nav>

      <RouterLink to="/" class="admin-exit">回到前台</RouterLink>
    </div>

    <div class="admin-body">
      <div class="admin-crumb">
        控制台<span class="sep">/</span><span class="cur">{{ current }}</span>
      </div>
      <RouterView />
    </div>
  </div>
</template>
