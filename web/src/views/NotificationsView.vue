<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NList, NListItem, NThing, NTag, NEmpty, NSpin, NButton, NSpace, useMessage } from 'naive-ui';
import { RouterLink } from 'vue-router';
import { api } from '../api';

const message = useMessage();
const loading = ref(true);
const items = ref<any[]>([]);
const unread = ref(0);

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>('/api/notifications?size=50');
    items.value = data.items ?? [];
    unread.value = data.unread ?? 0;
  } finally {
    loading.value = false;
  }
}

async function readAll() {
  await api.post('/api/notifications/read', {});
  message.success('已全部标记为已读');
  await load();
}

async function open(item: any) {
  if (!item.isRead) await api.post('/api/notifications/read', { ids: [item.id] });
  if (item.link) window.location.href = item.link;
  else await load();
}

onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <n-card>
      <template #header>
        <n-space align="center">
          <span>消息中心</span>
          <n-tag v-if="unread" type="error" size="small">{{ unread }} 条未读</n-tag>
        </n-space>
      </template>
      <template #header-extra>
        <n-button size="small" :disabled="!unread" @click="readAll">全部已读</n-button>
      </template>

      <n-empty v-if="!items.length" description="还没有消息" />
      <n-list v-else>
        <n-list-item v-for="item in items" :key="item.id" class="cursor-pointer" @click="open(item)">
          <n-thing>
            <template #header>
              <n-space align="center" :size="6">
                <span :class="item.isRead ? 'opacity-60' : 'font-medium'">{{ item.title }}</span>
                <n-tag v-if="!item.isRead" size="tiny" type="error">未读</n-tag>
              </n-space>
            </template>
            <template #description>
              <div class="text-sm opacity-70">{{ item.content }}</div>
              <div class="mt-1 text-xs opacity-50">{{ new Date(item.createdAt).toLocaleString() }}</div>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
    </n-card>
  </n-spin>
</template>
