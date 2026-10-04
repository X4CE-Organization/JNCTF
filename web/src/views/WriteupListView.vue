<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NList, NListItem, NThing, NTag, NEmpty, NSpin, NButton, NSpace } from 'naive-ui';
import { RouterLink } from 'vue-router';
import { api } from '../api';

const loading = ref(true);
const items = ref<any[]>([]);

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>('/api/writeups?size=50');
    items.value = data.items ?? [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <n-card title="题解广场">
      <n-empty v-if="!items.length" description="还没有公开的题解" />
      <n-list v-else>
        <n-list-item v-for="w in items" :key="w.id">
          <n-thing :title="w.title">
            <template #description>
              <n-space :size="8">
                <RouterLink :to="`/users/${w.author.username}`" class="text-indigo-500 hover:underline">
                  {{ w.author.displayName }}
                </RouterLink>
                <span class="text-xs opacity-60">{{ w.challenge.title }}</span>
                <n-tag size="tiny" :bordered="false">{{ w.likes }} 赞</n-tag>
                <span class="text-xs opacity-50">{{ new Date(w.createdAt).toLocaleDateString() }}</span>
              </n-space>
            </template>
          </n-thing>
          <template #suffix>
            <n-button size="small" tag="a" :href="`/writeups/${w.id}`">阅读</n-button>
          </template>
        </n-list-item>
      </n-list>
    </n-card>
  </n-spin>
</template>
