<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NDataTable, NInput, NButton, NSpace, NModal, NForm, NFormItem, NSelect, NInputNumber, NSwitch, NTag, useMessage, useDialog } from 'naive-ui';
import { api, query } from '../../api';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const message = useMessage();
const dialog = useDialog();
const loading = ref(false);
const items = ref<any[]>([]);
const editOpen = ref(false);
const form = ref<any>({});
const flagInput = ref('');
const hintInput = ref('');

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '标题', key: 'title' },
  { title: '分类', key: 'category', width: 100 },
  { title: '难度', key: 'difficulty', width: 90 },
  { title: '分值', key: 'score', width: 90, render: (r: any) => (r.scoringType === 'DYNAMIC' ? `${r.minScore}~${r.score}` : r.score) },
  { title: '状态', key: 'state', width: 90 },
  { title: '解出', key: 'solveCount', width: 70 },
  { title: 'flag', key: 'flagCount', width: 70 },
];

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>('/api/admin/challenges?size=100');
    items.value = data.items;
  } finally {
    loading.value = false;
  }
}

function create() {
  form.value = { title: '', description: '', difficulty: 'EASY', state: 'VISIBLE', scoringType: 'STATIC', score: 100, minScore: 20, decay: 30, categoryId: null, flags: [], hints: [], tags: [] };
  flagInput.value = '';
  hintInput.value = '';
  editOpen.value = true;
}

async function edit(row: any) {
  const data = await api.get<any>(`/api/challenges/${row.id}`).catch(() => null);
  form.value = {
    id: row.id, title: row.title, description: data?.description ?? '', difficulty: row.difficulty, state: row.state,
    scoringType: row.scoringType, score: row.score, minScore: row.minScore, decay: row.decay,
    categoryId: row.categoryId, flags: [], hints: [], tags: row.tags?.map((t: any) => t.name) ?? [],
  };
  editOpen.value = true;
}

async function save() {
  const payload = { ...form.value, flags: (form.value.flags ?? []).map((f: string) => ({ flag: f })), hints: (form.value.hints ?? []).map((h: string) => ({ content: h, cost: 0 })) };
  try {
    if (form.value.id) await api.put(`/api/admin/challenges/${form.value.id}`, payload);
    else await api.post('/api/admin/challenges', payload);
    message.success('已保存');
    editOpen.value = false;
    await load();
  } catch (err: any) {
    message.error(err?.message ?? '保存失败');
  }
}

function remove(row: any) {
  dialog.error({
    title: '删除题目', content: `确定删除「${row.title}」吗？`,
    positiveText: '删除', negativeText: '取消',
    onPositiveClick: async () => { await api.del(`/api/admin/challenges/${row.id}`); message.success('已删除'); await load(); },
  });
}

onMounted(load);
</script>

<template>
  <div class="space-y-3">
    <n-card size="small">
      <n-space><n-button type="primary" @click="create">新建题目</n-button><n-button @click="load">刷新</n-button></n-space>
    </n-card>
    <n-card size="small">
      <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" size="small" :row-key="(r: any) => r.id" />
    </n-card>
    <n-modal v-model:show="editOpen" preset="card" :title="form.id ? '编辑题目' : '新建题目'" style="max-width: 720px">
      <n-form>
        <n-form-item label="标题"><n-input v-model:value="form.title" /></n-form-item>
        <n-form-item label="题面（Markdown）"><n-input v-model:value="form.description" type="textarea" :rows="6" /></n-form-item>
        <n-space>
          <n-form-item label="分类">
            <n-select v-model:value="form.categoryId" style="width: 160px" :options="auth.categories.map((c) => ({ label: c.name, value: c.id }))" />
          </n-form-item>
          <n-form-item label="难度">
            <n-select v-model:value="form.difficulty" style="width: 130px" :options="[{ label: '入门', value: 'BEGINNER' }, { label: '简单', value: 'EASY' }, { label: '中等', value: 'MEDIUM' }, { label: '困难', value: 'HARD' }, { label: '地狱', value: 'INSANE' }]" />
          </n-form-item>
          <n-form-item label="状态">
            <n-select v-model:value="form.state" style="width: 130px" :options="[{ label: '可见', value: 'VISIBLE' }, { label: '隐藏', value: 'HIDDEN' }, { label: '关闭提交', value: 'CLOSED' }]" />
          </n-form-item>
        </n-space>
        <n-space>
          <n-form-item label="计分方式">
            <n-select v-model:value="form.scoringType" style="width: 150px" :options="[{ label: '固定分值', value: 'STATIC' }, { label: '动态分值', value: 'DYNAMIC' }]" />
          </n-form-item>
          <n-form-item :label="form.scoringType === 'DYNAMIC' ? '最高分' : '分值'"><n-input-number v-model:value="form.score" style="width: 120px" /></n-form-item>
          <template v-if="form.scoringType === 'DYNAMIC'">
            <n-form-item label="最低分"><n-input-number v-model:value="form.minScore" style="width: 120px" /></n-form-item>
            <n-form-item label="衰减系数"><n-input-number v-model:value="form.decay" style="width: 120px" /></n-form-item>
          </template>
        </n-space>
        <n-form-item label="flag（可多个）">
          <n-space vertical style="width: 100%">
            <n-space><n-input v-model:value="flagInput" placeholder="flag{...}" style="width: 320px" />
              <n-button @click="if (flagInput.trim()) { form.flags = [...(form.flags ?? []), flagInput.trim()]; flagInput = ''; }">添加</n-button></n-space>
            <n-space><n-tag v-for="(f, i) in form.flags ?? []" :key="i" closable @close="form.flags = form.flags.filter((_: any, j: number) => j !== i)">{{ f }}</n-tag></n-space>
          </n-space>
        </n-form-item>
        <n-form-item label="提示（可多条）">
          <n-space vertical style="width: 100%">
            <n-space><n-input v-model:value="hintInput" style="width: 320px" />
              <n-button @click="if (hintInput.trim()) { form.hints = [...(form.hints ?? []), hintInput.trim()]; hintInput = ''; }">添加</n-button></n-space>
            <n-space><n-tag v-for="(h, i) in form.hints ?? []" :key="i" closable @close="form.hints = form.hints.filter((_: any, j: number) => j !== i)">{{ h }}</n-tag></n-space>
          </n-space>
        </n-form-item>
        <n-form-item label="标签（逗号分隔）">
          <n-input :value="(form.tags ?? []).join(', ')" @update:value="(v: string) => form.tags = v.split(',').map((s) => s.trim()).filter(Boolean)" />
        </n-form-item>
        <n-form-item label="需要动态靶机"><n-switch v-model:value="form.requiresContainer" /></n-form-item>
        <template v-if="form.requiresContainer">
          <n-space>
            <n-form-item label="Docker 镜像"><n-input v-model:value="form.dockerImage" style="width: 280px" placeholder="ctf/web-1.0" /></n-form-item>
            <n-form-item label="容器端口"><n-input-number v-model:value="form.containerPort" style="width: 120px" /></n-form-item>
          </n-space>
        </template>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button v-if="form.id" type="error" ghost @click="remove(form)">删除</n-button>
          <n-button @click="editOpen = false">取消</n-button>
          <n-button type="primary" @click="save">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
