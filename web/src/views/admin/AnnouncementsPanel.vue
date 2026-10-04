<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NList, NListItem, NThing, NButton, NSpace, NTag, NModal, NInput, NSelect, NSwitch, useMessage } from 'naive-ui';
import { api } from '../../api';

const message = useMessage();
const items = ref<any[]>([]);
const editOpen = ref(false);
const form = ref<any>({});

async function load() {
  const data = await api.get<any>('/api/site/meta');
  items.value = data.announcements ?? [];
}

function create() {
  form.value = { title: '', content: '', level: 'INFO', pinned: false, visible: true };
  editOpen.value = true;
}

async function save() {
  await api.post('/api/admin/announcements', form.value);
  message.success('已发布');
  editOpen.value = false;
  await load();
}

async function remove(item: any) {
  await api.del(`/api/admin/announcements/${item.id}`);
  message.success('已删除');
  await load();
}

onMounted(load);
</script>

<template>
  <div class="space-y-3">
    <n-card size="small"><n-button type="primary" @click="create">发布公告</n-button></n-card>
    <n-card size="small" title="已有公告">
      <n-list>
        <n-list-item v-for="a in items" :key="a.id">
          <n-thing :title="a.title">
            <template #description>
              <n-space :size="6">
                <n-tag v-if="a.pinned" size="tiny" type="warning">置顶</n-tag>
                <n-tag size="tiny" :bordered="false">{{ a.level }}</n-tag>
                <span class="text-xs opacity-50">{{ new Date(a.publishedAt).toLocaleString() }}</span>
              </n-space>
            </template>
          </n-thing>
          <template #suffix><n-button size="tiny" type="error" text @click="remove(a)">删除</n-button></template>
        </n-list-item>
      </n-list>
    </n-card>

    <n-modal v-model:show="editOpen" preset="card" title="发布公告" style="max-width: 600px">
      <n-space vertical>
        <n-input v-model:value="form.title" placeholder="公告标题" />
        <n-input v-model:value="form.content" type="textarea" :rows="6" placeholder="公告内容（支持 Markdown）" />
        <n-space align="center">
          <n-select v-model:value="form.level" style="width: 140px" :options="[{ label: '普通', value: 'INFO' }, { label: '警告', value: 'WARNING' }, { label: '重要', value: 'IMPORTANT' }]" />
          <span>置顶</span><n-switch v-model:value="form.pinned" />
          <span>可见</span><n-switch v-model:value="form.visible" />
        </n-space>
        <n-button type="primary" @click="save">发布</n-button>
      </n-space>
    </n-modal>
  </div>
</template>
