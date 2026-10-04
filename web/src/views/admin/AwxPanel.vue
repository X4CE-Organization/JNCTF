<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NDataTable, NButton, NSpace, NModal, NForm, NFormItem, NInput, NInputNumber, NAlert, NTag, useMessage } from 'naive-ui';
import { useRoute } from 'vue-router';
import { api } from '../../api';

const route = useRoute();
const message = useMessage();
const loading = ref(false);
const items = ref<any[]>([]);
const dockerEnabled = ref(false);
const editOpen = ref(false);
const form = ref<any>({});

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '服务名', key: 'name' },
  { title: '镜像', key: 'dockerImage' },
  { title: '端口', key: 'internalPort', width: 80 },
  { title: 'flag 模板', key: 'flagTemplate' },
  { title: '靶机数', key: '_count', width: 90, render: (r: any) => r._count?.targets ?? 0 },
];

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>(`/api/admin/competitions/${route.params.id}/awx-services`);
    items.value = data.items ?? [];
    dockerEnabled.value = Boolean(data.dockerEnabled);
  } finally {
    loading.value = false;
  }
}

function create() {
  form.value = { name: '', dockerImage: '', internalPort: 80, flagEnv: 'FLAG', flagFile: '', flagTemplate: 'flag{{{random}}}', checkPath: '/', baseScore: 20, memoryLimitMb: 512, cpuLimit: '1' };
  editOpen.value = true;
}

async function edit(row: any) {
  form.value = { ...row };
  editOpen.value = true;
}

async function save() {
  try {
    if (form.value.id) await api.put(`/api/admin/awx-services/${form.value.id}`, form.value);
    else await api.post(`/api/admin/competitions/${route.params.id}/awx-services`, form.value);
    message.success('已保存');
    editOpen.value = false;
    await load();
  } catch (err: any) {
    message.error(err?.message ?? '保存失败');
  }
}

async function prepare() {
  try {
    const data = await api.post<any>(`/api/awd/competitions/${route.params.id}/prepare`);
    message.success(`靶机已准备：成功 ${data.created}，失败 ${data.failed}`);
  } catch (err: any) {
    message.error(err?.message ?? '准备失败');
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-3">
    <n-alert v-if="!dockerEnabled" type="warning">
      本机未启用动态靶机（需要在 .env 里设置 DOCKER_ENABLED=true 并保证能访问 Docker）。
      配置仍然可以保存，启用后即可起容器。
    </n-alert>
    <n-card size="small">
      <n-space>
        <n-button type="primary" @click="create">新增服务</n-button>
        <n-button @click="prepare">一键准备全部靶机</n-button>
        <n-button @click="load">刷新</n-button>
        <n-tag v-if="!dockerEnabled" type="warning" class="ml-auto">靶机未启用</n-tag>
      </n-space>
    </n-card>
    <n-card size="small">
      <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" size="small" :row-key="(r: any) => r.id" />
      <div class="mt-3 space-y-1">
        <div v-for="row in items" :key="row.id" class="text-xs">
          <n-button size="tiny" @click="edit(row)">编辑 {{ row.name }}</n-button>
        </div>
      </div>
    </n-card>

    <n-modal v-model:show="editOpen" preset="card" :title="form.id ? '编辑服务' : '新增 AWD 服务'" style="max-width: 640px">
      <n-form>
        <n-space>
          <n-form-item label="服务名"><n-input v-model:value="form.name" style="width: 200px" /></n-form-item>
          <n-form-item label="Docker 镜像"><n-input v-model:value="form.dockerImage" style="width: 260px" placeholder="ctf/web-1.0" /></n-form-item>
        </n-space>
        <n-space>
          <n-form-item label="容器端口"><n-input-number v-model:value="form.internalPort" style="width: 120px" /></n-form-item>
          <n-form-item label="flag 环境变量"><n-input v-model:value="form.flagEnv" style="width: 150px" /></n-form-item>
          <n-form-item label="flag 文件路径"><n-input v-model:value="form.flagFile" style="width: 200px" placeholder="/flag" /></n-form-item>
        </n-space>
        <n-form-item label="flag 模板"><n-input v-model:value="form.flagTemplate" placeholder="flag{{{random}}" /></n-form-item>
        <n-space>
          <n-form-item label="健康检查路径"><n-input v-model:value="form.checkPath" style="width: 180px" /></n-form-item>
          <n-form-item label="基础分"><n-input-number v-model:value="form.baseScore" style="width: 120px" /></n-form-item>
          <n-form-item label="内存上限 MB"><n-input-number v-model:value="form.memoryLimitMb" style="width: 130px" /></n-form-item>
          <n-form-item label="CPU"><n-input v-model:value="form.cpuLimit" style="width: 90px" /></n-form-item>
        </n-space>
      </n-form>
      <template #footer>
        <n-space justify="end"><n-button @click="editOpen = false">取消</n-button><n-button type="primary" @click="save">保存</n-button></n-space>
      </template>
    </n-modal>
  </div>
</template>
