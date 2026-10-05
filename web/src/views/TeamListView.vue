<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NInput, NButton, NSpace, NDataTable, NModal, NForm, NFormItem, NAlert, useMessage } from 'naive-ui';
import { RouterLink, useRouter } from 'vue-router';
import { api, query } from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const message = useMessage();
const loading = ref(true);
const items = ref<any[]>([]);
const keyword = ref('');
const createOpen = ref(false);
const joinOpen = ref(false);
const createForm = ref({ name: '', affiliation: '', description: '' });
const joinCode = ref('');
const error = ref('');

const columns = [
  { title: '#', key: 'rank', width: 60, render: (_r: any, i: number) => i + 1 },
  { title: '队伍', key: 'name' },
  { title: '学校 / 单位', key: 'affiliation' },
  { title: '成员', key: 'memberCount', width: 80 },
  { title: '等级分', key: 'score', width: 100 },
];

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>(`/api/teams${query({ keyword: keyword.value, size: 100 })}`);
    items.value = data.items ?? [];
  } finally {
    loading.value = false;
  }
}

async function create() {
  error.value = '';
  try {
    const data = await api.post<any>('/api/teams', createForm.value);
    message.success('队伍已创建');
    createOpen.value = false;
    router.push(`/teams/${data.team.id}`);
  } catch (err: any) {
    error.value = err?.message ?? '创建失败';
  }
}

async function join() {
  error.value = '';
  try {
    const data = await api.post<any>('/api/teams/join', { code: joinCode.value.trim() });
    message.success(`已加入 ${data.name}`);
    joinOpen.value = false;
    router.push(`/teams/${data.id}`);
  } catch (err: any) {
    error.value = err?.message ?? '加入失败';
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <n-card size="small">
      <n-space align="center">
        <n-input v-model:value="keyword" placeholder="搜索队伍名" style="width: 220px" @keyup.enter="load" />
        <n-button @click="load">搜索</n-button>
        <template v-if="auth.isLogin">
          <n-button class="ml-auto" type="primary" @click="createOpen = true">创建队伍</n-button>
          <n-button @click="joinOpen = true">加入队伍</n-button>
        </template>
      </n-space>
    </n-card>
    <n-card>
      <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" size="small" :row-key="(r: any) => r.id" />
    </n-card>

    <n-modal v-model:show="createOpen" preset="card" title="创建队伍" style="max-width: 460px">
      <n-form>
        <n-form-item label="队伍名称"><n-input v-model:value="createForm.name" /></n-form-item>
        <n-form-item label="学校 / 单位"><n-input v-model:value="createForm.affiliation" /></n-form-item>
        <n-form-item label="队伍介绍"><n-input v-model:value="createForm.description" type="textarea" /></n-form-item>
      </n-form>
      <n-alert v-if="error" type="error">{{ error }}</n-alert>
      <template #footer>
        <n-space justify="end">
          <n-button @click="createOpen = false">取消</n-button>
          <n-button type="primary" @click="create">创建</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="joinOpen" preset="card" title="加入队伍" style="max-width: 420px">
      <n-input v-model:value="joinCode" placeholder="输入队伍邀请码" />
      <n-alert v-if="error" type="error" class="mt-3">{{ error }}</n-alert>
      <template #footer>
        <n-space justify="end">
          <n-button @click="joinOpen = false">取消</n-button>
          <n-button type="primary" @click="join">加入</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
