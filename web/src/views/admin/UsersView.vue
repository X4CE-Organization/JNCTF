<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NDataTable, NInput, NSelect, NButton, NSpace, NModal, NForm, NFormItem, NSwitch, useMessage, useDialog } from 'naive-ui';
import { api, query } from '../../api';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const message = useMessage();
const dialog = useDialog();
const loading = ref(false);
const items = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const keyword = ref('');
const role = ref('');
const status = ref('');
const editing = ref<any>(null);
const form = ref<any>({});

const columns = [
  { title: 'ID', key: 'id', width: 70 },
  { title: '用户名', key: 'username', width: 140 },
  { title: '昵称', key: 'displayName', width: 140 },
  { title: '邮箱', key: 'email', width: 180 },
  { title: '角色', key: 'role', width: 120, render: (r: any) => ({ USER: '普通用户', ADMIN: '管理员', SUPER_ADMIN: '超级管理员' }[r.role as string]) },
  { title: '等级分', key: 'score', width: 80 },
  { title: '积分', key: 'points', width: 80 },
  { title: '队伍', key: 'team', width: 120, render: (r: any) => r.team?.name ?? '—' },
  { title: '状态', key: 'banned', width: 90, render: (r: any) => (r.banned ? '已封禁' : r.status) },
  { title: '操作', key: 'actions', width: 150, render: (row: any) => row },
];

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>(`/api/admin/users${query({ keyword: keyword.value, role: role.value, status: status.value, page: page.value, size: 30 })}`);
    items.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function edit(row: any) {
  editing.value = row;
  form.value = { displayName: row.displayName, email: row.email, role: row.role, banned: row.banned, banReason: row.banReason, score: row.score, hidden: row.hidden };
}

async function save() {
  await api.put(`/api/admin/users/${editing.value.id}`, form.value);
  message.success('已保存');
  editing.value = null;
  await load();
}

function remove(row: any) {
  dialog.error({
    title: '删除用户',
    content: `确定删除 ${row.username} 吗？该操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.del(`/api/admin/users/${row.id}`);
        message.success('已删除');
        await load();
      } catch (err: any) {
        message.error(err?.message ?? '删除失败');
      }
    },
  });
}

onMounted(load);
</script>

<template>
  <div class="space-y-3">
    <n-card size="small">
      <n-space align="center">
        <n-input v-model:value="keyword" placeholder="搜索用户名 / 邮箱 / 昵称" style="width: 240px" @keyup.enter="load" />
        <n-select v-model:value="role" style="width: 150px" :options="[{ label: '全部角色', value: '' }, { label: '普通用户', value: 'USER' }, { label: '管理员', value: 'ADMIN' }, { label: '超级管理员', value: 'SUPER_ADMIN' }]" />
        <n-select v-model:value="status" style="width: 130px" :options="[{ label: '全部状态', value: '' }, { label: '正常', value: 'ACTIVE' }, { label: '待验证', value: 'PENDING' }, { label: '封禁', value: 'BANNED' }]" />
        <n-button @click="load">查询</n-button>
        <span class="ml-auto text-sm opacity-60">共 {{ total }} 人</span>
      </n-space>
    </n-card>

    <n-card size="small">
      <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" size="small" :row-key="(r: any) => r.id">
        <template #empty>暂无数据</template>
      </n-data-table>
      <n-space justify="center" class="mt-3">
        <n-button size="small" :disabled="page <= 1" @click="page--; load()">上一页</n-button>
        <span class="text-sm">第 {{ page }} 页</span>
        <n-button size="small" :disabled="items.length < 30" @click="page++; load()">下一页</n-button>
      </n-space>
    </n-card>

    <n-modal :show="Boolean(editing)" preset="card" title="编辑用户" style="max-width: 480px" @update:show="(v: boolean) => { if (!v) editing = null; }">
      <n-form>
        <n-form-item label="昵称"><n-input v-model:value="form.displayName" /></n-form-item>
        <n-form-item label="邮箱"><n-input v-model:value="form.email" /></n-form-item>
        <n-form-item v-if="auth.isSuperAdmin" label="角色">
          <n-select v-model:value="form.role" :options="[{ label: '普通用户', value: 'USER' }, { label: '管理员', value: 'ADMIN' }, { label: '超级管理员', value: 'SUPER_ADMIN' }]" />
        </n-form-item>
        <n-form-item v-if="auth.isSuperAdmin" label="等级分"><n-input-number v-model:value="form.score" /></n-form-item>
        <n-form-item label="封禁"><n-switch v-model:value="form.banned" /></n-form-item>
        <n-form-item v-if="form.banned" label="封禁原因"><n-input v-model:value="form.banReason" /></n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button v-if="auth.isSuperAdmin" type="error" ghost @click="remove(editing)">删除用户</n-button>
          <n-button @click="editing = null">取消</n-button>
          <n-button type="primary" @click="save">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
