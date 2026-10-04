<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NMenu, NTag, NSpace, NButton } from 'naive-ui';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const menuOptions = computed(() => {
  const items: any[] = [
    { label: '控制台总览', key: '/admin' },
    { label: '用户管理', key: '/admin/users' },
    { label: '题目管理', key: '/admin/challenges' },
    { label: '比赛管理', key: '/admin/competitions' },
    { label: '题解审核', key: '/admin/writeups' },
    { label: '工单处理', key: '/admin/tickets' },
    { label: '公告管理', key: '/admin/announcements' },
  ];
  if (auth.isSuperAdmin) {
    items.push({ label: '操作日志', key: '/admin/logs' }, { label: '系统设置', key: '/admin/settings' });
  }
  return items;
});
</script>

<template>
  <div class="space-y-4">
    <n-card size="small">
      <n-space align="center">
        <span class="text-base font-semibold">管理控制台</span>
        <n-tag size="small" :type="auth.isSuperAdmin ? 'error' : 'warning'">
          {{ auth.isSuperAdmin ? '超级管理员' : '管理员' }}
        </n-tag>
        <span class="text-xs opacity-60">{{ auth.siteName }} · @{{ auth.user?.username }}</span>
        <n-button class="ml-auto" size="small" @click="router.push('/')">回到前台</n-button>
      </n-space>
    </n-card>

    <div class="grid gap-4 lg:grid-cols-[190px_1fr] lg:items-start">
      <n-card class="lg:sticky lg:top-20" size="small">
        <n-menu :options="menuOptions" :value="route.path" @update:value="(key: string) => router.push(key)" />
      </n-card>
      <RouterView />
    </div>
  </div>
</template>
