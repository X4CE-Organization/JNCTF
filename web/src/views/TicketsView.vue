<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NList, NListItem, NThing, NTag, NEmpty, NSpin, NButton, NSpace, NModal, NInput, NSelect, useMessage } from 'naive-ui';
import { api } from '../api';

const message = useMessage();
const loading = ref(true);
const items = ref<any[]>([]);
const createOpen = ref(false);
const detail = ref<any>(null);
const form = ref({ subject: '', category: 'OTHER', priority: 'NORMAL', content: '' });
const reply = ref('');

const STATUS: Record<string, { label: string; type: any }> = {
  OPEN: { label: '待处理', type: 'warning' },
  PENDING: { label: '处理中', type: 'info' },
  RESOLVED: { label: '已解决', type: 'success' },
  CLOSED: { label: '已关闭', type: 'default' },
};

const categoryOptions = [
  { label: '题目问题', value: 'CHALLENGE' },
  { label: '账号问题', value: 'ACCOUNT' },
  { label: '比赛问题', value: 'COMPETITION' },
  { label: '举报作弊', value: 'REPORT' },
  { label: '其它', value: 'OTHER' },
];

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>('/api/tickets');
    items.value = data.items ?? [];
  } finally {
    loading.value = false;
  }
}

async function create() {
  if (!form.value.subject.trim() || !form.value.content.trim()) return message.error('标题和内容都要填');
  await api.post('/api/tickets', form.value);
  message.success('工单已提交');
  createOpen.value = false;
  form.value = { subject: '', category: 'OTHER', priority: 'NORMAL', content: '' };
  await load();
}

async function open(item: any) {
  detail.value = await api.get<any>(`/api/tickets/${item.id}`);
}

async function sendReply() {
  if (!reply.value.trim()) return;
  await api.post(`/api/tickets/${detail.value.id}/reply`, { content: reply.value });
  reply.value = '';
  detail.value = await api.get<any>(`/api/tickets/${detail.value.id}`);
  await load();
}

onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <n-card>
      <template #header>我的工单</template>
      <template #header-extra>
        <n-button size="small" type="primary" @click="createOpen = true">提交工单</n-button>
      </template>
      <n-empty v-if="!items.length" description="还没有提交过工单" />
      <n-list v-else>
        <n-list-item v-for="t in items" :key="t.id" class="cursor-pointer" @click="open(t)">
          <n-thing>
            <template #header>
              <n-space align="center" :size="6">
                <span class="font-medium">{{ t.subject }}</span>
                <n-tag size="tiny" :type="STATUS[t.status]?.type">{{ STATUS[t.status]?.label }}</n-tag>
                <n-tag size="tiny" :bordered="false">{{ t.messageCount }} 条回复</n-tag>
              </n-space>
            </template>
            <template #description>
              <span class="text-xs opacity-50">创建于 {{ new Date(t.createdAt).toLocaleString() }}</span>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
    </n-card>

    <n-modal v-model:show="createOpen" preset="card" title="提交工单" style="max-width: 560px">
      <n-space vertical>
        <n-input v-model:value="form.subject" placeholder="标题" />
        <n-select v-model:value="form.category" :options="categoryOptions" />
        <n-input v-model:value="form.content" type="textarea" :rows="5" placeholder="详细描述你遇到的问题" />
        <n-button type="primary" @click="create">提交</n-button>
      </n-space>
    </n-modal>

    <n-modal v-model:show="detail" preset="card" :title="detail?.subject" style="max-width: 640px">
      <n-tag :type="STATUS[detail?.status]?.type" size="small">{{ STATUS[detail?.status]?.label }}</n-tag>
      <div class="mt-3 max-h-80 space-y-3 overflow-y-auto">
        <div v-for="m in detail?.messages ?? []" :key="m.id" class="rounded-lg bg-black/5 p-3">
          <div class="flex items-center gap-2 text-xs opacity-60">
            <span class="font-medium">{{ m.user.displayName }}</span>
            <n-tag v-if="m.user.isStaff" size="tiny" type="info">管理员</n-tag>
            <n-tag v-if="m.internal" size="tiny" type="warning">内部备注</n-tag>
            <span class="ml-auto">{{ new Date(m.createdAt).toLocaleString() }}</span>
          </div>
          <div class="mt-1 whitespace-pre-wrap text-sm">{{ m.content }}</div>
        </div>
      </div>
      <n-input v-model:value="reply" class="mt-3" type="textarea" :rows="3" placeholder="输入回复" />
      <n-space class="mt-2" justify="end">
        <n-button type="primary" @click="sendReply">回复</n-button>
      </n-space>
    </n-modal>
  </n-spin>
</template>
