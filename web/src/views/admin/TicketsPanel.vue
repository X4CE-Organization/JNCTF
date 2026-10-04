<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NDataTable, NSelect, NSpace, NButton, NModal, NInput, useMessage } from 'naive-ui';
import { api } from '../../api';

const message = useMessage();
const status = ref('');
const items = ref<any[]>([]);
const detail = ref<any>(null);
const reply = ref('');
const internal = ref(false);

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '标题', key: 'subject' },
  { title: '提交人', key: 'user', width: 140, render: (r: any) => r.user?.displayName || r.user?.username },
  { title: '状态', key: 'status', width: 100 },
  { title: '处理人', key: 'assignee', width: 120, render: (r: any) => r.assignee?.displayName ?? '未分配' },
  { title: '回复', key: '_count', width: 70, render: (r: any) => r._count?.messages ?? 0 },
];

async function load() {
  const data = await api.get<any>(`/api/admin/tickets?size=100${status.value ? `&status=${status.value}` : ''}`);
  items.value = data.items ?? [];
}

async function open(row: any) {
  detail.value = await api.get<any>(`/api/tickets/${row.id}`);
  if (row.assigneeId === null) await api.put(`/api/admin/tickets/${row.id}`, { assigneeId: 0 });
}

async function send(close = false) {
  if (!reply.value.trim()) return;
  await api.post(`/api/tickets/${detail.value.id}/reply`, { content: reply.value, internal });
  if (close) await api.put(`/api/admin/tickets/${detail.value.id}`, { status: 'RESOLVED' });
  reply.value = '';
  detail.value = await api.get<any>(`/api/tickets/${detail.value.id}`);
  await load();
  message.success(close ? '已回复并标记为已解决' : '已回复');
}

onMounted(load);
</script>

<template>
  <div class="space-y-3">
    <n-card size="small">
      <n-space align="center">
        <n-select v-model:value="status" style="width: 160px" :options="[{ label: '全部', value: '' }, { label: '待处理', value: 'OPEN' }, { label: '处理中', value: 'PENDING' }, { label: '已解决', value: 'RESOLVED' }, { label: '已关闭', value: 'CLOSED' }]" @update:value="load" />
        <n-button @click="load">刷新</n-button>
      </n-space>
    </n-card>
    <n-card size="small">
      <n-data-table :columns="columns" :data="items" :bordered="false" size="small" :row-key="(r: any) => r.id" />
      <div class="mt-3 space-y-1">
        <n-button v-for="row in items" :key="row.id" size="tiny" class="mr-2" @click="open(row)">处理 #{{ row.id }} {{ row.subject }}</n-button>
      </div>
    </n-card>

    <n-modal v-model:show="detail" preset="card" :title="detail?.subject" style="max-width: 680px">
      <div class="max-h-80 space-y-2 overflow-y-auto">
        <div v-for="m in detail?.messages ?? []" :key="m.id" class="rounded-lg bg-black/5 p-3">
          <div class="text-xs opacity-60">
            {{ m.user.displayName }}
            <n-tag v-if="m.user.isStaff" size="tiny" type="info">管理员</n-tag>
            <n-tag v-if="m.internal" size="tiny" type="warning">内部备注</n-tag>
            <span class="ml-2">{{ new Date(m.createdAt).toLocaleString() }}</span>
          </div>
          <div class="mt-1 whitespace-pre-wrap text-sm">{{ m.content }}</div>
        </div>
      </div>
      <n-input v-model:value="reply" class="mt-3" type="textarea" :rows="3" placeholder="回复内容" />
      <n-space class="mt-2" justify="end" align="center">
        <n-button size="small" :type="internal ? 'warning' : 'default'" @click="internal = !internal">
          {{ internal ? '内部备注：开' : '内部备注：关' }}
        </n-button>
        <n-button @click="send(false)">回复</n-button>
        <n-button type="primary" @click="send(true)">回复并标记已解决</n-button>
      </n-space>
    </n-modal>
  </div>
</template>
