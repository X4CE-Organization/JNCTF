<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NList, NListItem, NThing, NButton, NSpace, NTag, NEmpty, NSelect, useMessage } from 'naive-ui';
import { api } from '../../api';

const message = useMessage();
const state = ref('PENDING');
const items = ref<any[]>([]);

async function load() {
  const data = await api.get<any>(`/api/admin/writeups?state=${state.value}`);
  items.value = data.items ?? [];
}

async function review(item: any, approve: boolean) {
  await api.post(`/api/admin/writeups/${item.id}/review`, { approve, reason: approve ? '' : '内容不符合要求' });
  message.success(approve ? '已通过' : '已驳回');
  await load();
}

onMounted(load);
</script>

<template>
  <n-card size="small" title="题解审核">
    <template #header-extra>
      <n-select v-model:value="state" style="width: 140px" size="small" :options="[{ label: '待审核', value: 'PENDING' }, { label: '已通过', value: 'APPROVED' }, { label: '已驳回', value: 'REJECTED' }]" @update:value="load" />
    </template>
    <n-empty v-if="!items.length" description="没有需要处理的题解" />
    <n-list v-else>
      <n-list-item v-for="w in items" :key="w.id">
        <n-thing :title="w.title">
          <template #description>
            <n-space :size="6">
              <span>{{ w.user?.displayName || w.user?.username }}</span>
              <n-tag size="tiny" :bordered="false">{{ w.challenge?.title }}</n-tag>
              <span class="text-xs opacity-50">{{ new Date(w.createdAt).toLocaleString() }}</span>
            </n-space>
          </template>
        </n-thing>
        <template #suffix>
          <n-space v-if="w.state === 'PENDING'">
            <n-button size="tiny" type="primary" @click="review(w, true)">通过</n-button>
            <n-button size="tiny" type="error" ghost @click="review(w, false)">驳回</n-button>
          </n-space>
          <n-tag v-else size="small">{{ w.state }}</n-tag>
        </template>
      </n-list-item>
    </n-list>
  </n-card>
</template>
