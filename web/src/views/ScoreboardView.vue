<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { NCard, NDataTable, NRadioGroup, NRadioButton, NSpace, NTag, NAvatar } from 'naive-ui';
import { RouterLink } from 'vue-router';
import { api, query } from '../api';

const type = ref<'user' | 'team'>('user');
const loading = ref(false);
const items = ref<any[]>([]);

const columns = [
  {
    title: '#',
    key: 'rank',
    width: 70,
    render: (row: any) =>
      row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank,
  },
  {
    title: type.value === 'team' ? '队伍' : '选手',
    key: 'name',
    render: (row: any) => row.name,
  },
  { title: '总分', key: 'score', width: 110, sorter: (a: any, b: any) => b.score - a.score },
  { title: '解题数', key: 'solveCount', width: 100 },
  {
    title: '最后解出',
    key: 'lastSolveAt',
    width: 180,
    render: (row: any) => (row.lastSolveAt ? new Date(row.lastSolveAt).toLocaleString() : '—'),
  },
];

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>(`/api/scoreboard${query({ type: type.value, limit: 200 })}`);
    items.value = data.items ?? [];
  } finally {
    loading.value = false;
  }
}

watch(type, load);
onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <n-card size="small">
      <n-space align="center">
        <span class="font-medium">榜单类型</span>
        <n-radio-group v-model:value="type" size="small">
          <n-radio-button value="user">个人榜</n-radio-button>
          <n-radio-button value="team">团队榜</n-radio-button>
        </n-radio-group>
        <n-tag class="ml-auto" :bordered="false">共 {{ items.length }} 条</n-tag>
      </n-space>
    </n-card>
    <n-card>
      <n-data-table
        :columns="columns"
        :data="items"
        :loading="loading"
        :row-key="(row: any) => row.id"
        :bordered="false"
        size="small"
      />
    </n-card>
  </div>
</template>
