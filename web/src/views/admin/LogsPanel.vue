<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NDataTable, NInput, NButton, NSpace, NTabs, NTabPane, NTag, NDescriptions, NDescriptionsItem, NList, NListItem } from 'naive-ui';
import { api } from '../../api';

const loading = ref(false);
const keyword = ref('');
const logs = ref<any[]>([]);
const loginLogs = ref<any[]>([]);
const system = ref<any>(null);

const logColumns = [
  { title: '时间', key: 'createdAt', width: 180, render: (r: any) => new Date(r.createdAt).toLocaleString() },
  { title: '操作者', key: 'actorName', width: 120 },
  { title: '动作', key: 'action', width: 200 },
  { title: '对象', key: 'target', width: 160, render: (r: any) => `${r.targetType ?? ''} ${r.targetId ?? ''}`.trim() },
  { title: 'IP', key: 'ip', width: 130 },
  { title: '详情', key: 'detail' },
];

const loginColumns = [
  { title: '时间', key: 'createdAt', width: 180, render: (r: any) => new Date(r.createdAt).toLocaleString() },
  { title: '用户名', key: 'username', width: 140 },
  { title: '结果', key: 'success', width: 90, render: (r: any) => (r.success ? '成功' : '失败') },
  { title: 'IP', key: 'ip', width: 140 },
  { title: 'User-Agent', key: 'userAgent' },
];

async function loadLogs() {
  loading.value = true;
  try {
    const [l, ll, s] = await Promise.all([
      api.get<any>(`/api/admin/logs?size=100${keyword.value ? `&keyword=${encodeURIComponent(keyword.value)}` : ''}`),
      api.get<any>('/api/admin/logs/login'),
      api.get<any>('/api/admin/system').catch(() => null),
    ]);
    logs.value = l.items ?? [];
    loginLogs.value = ll.items ?? [];
    system.value = s;
  } finally {
    loading.value = false;
  }
}

onMounted(loadLogs);
</script>

<template>
  <n-card size="small">
    <n-tabs type="line" animated>
      <n-tab-pane name="audit" tab="操作日志">
        <n-space class="mb-3"><n-input v-model:value="keyword" placeholder="搜索动作或操作者" style="width: 240px" @keyup.enter="loadLogs" /><n-button @click="loadLogs">查询</n-button></n-space>
        <n-data-table :columns="logColumns" :data="logs" :loading="loading" :bordered="false" size="small" :row-key="(r: any) => r.id" />
      </n-tab-pane>
      <n-tab-pane name="login" tab="登录日志">
        <n-data-table :columns="loginColumns" :data="loginLogs" :bordered="false" size="small" :row-key="(r: any) => r.id" />
      </n-tab-pane>
      <n-tab-pane name="system" tab="运行状态">
        <n-descriptions v-if="system" :column="2" bordered size="small">
          <n-descriptions-item label="数据库">{{ system.database.connected ? '已连接' : '异常' }}</n-descriptions-item>
          <n-descriptions-item label="Redis">{{ system.redis.status }}</n-descriptions-item>
          <n-descriptions-item label="动态靶机">{{ system.docker?.enabled ? `已启用（运行中 ${system.docker.running}）` : '未启用' }}</n-descriptions-item>
          <n-descriptions-item label="运行环境">{{ system.runtime.env }}</n-descriptions-item>
          <n-descriptions-item label="Node 版本">{{ system.runtime.node }}</n-descriptions-item>
          <n-descriptions-item label="内存占用">{{ system.runtime.memoryMb }} MB</n-descriptions-item>
          <n-descriptions-item label="运行时长">{{ Math.floor(system.runtime.uptimeSeconds / 60) }} 分钟</n-descriptions-item>
          <n-descriptions-item label="数据量">
            用户 {{ system.counts.users }} · 题目 {{ system.counts.challenges }} · 提交 {{ system.counts.submissions }} · 附件 {{ system.counts.attachments }}
          </n-descriptions-item>
        </n-descriptions>
      </n-tab-pane>
    </n-tabs>
  </n-card>
</template>
