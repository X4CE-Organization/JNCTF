<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NTag, NSpace, NButton, NSpin, NList, NListItem, NThing, NEmpty, useMessage, useDialog, NInput } from 'naive-ui';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const message = useMessage();
const dialog = useDialog();
const loading = ref(true);
const team = ref<any>(null);
const editing = ref(false);
const editForm = ref({ name: '', affiliation: '', description: '' });

async function load() {
  loading.value = true;
  try {
    team.value = await api.get<any>(`/api/teams/${route.params.id}`);
    editForm.value = { name: team.value.name, affiliation: team.value.affiliation, description: team.value.description };
  } finally {
    loading.value = false;
  }
}

async function save() {
  await api.put(`/api/teams/${team.value.id}`, editForm.value);
  message.success('已保存');
  editing.value = false;
  await load();
}

async function leave() {
  dialog.warning({
    title: '退出队伍',
    content: '确定要退出这支队伍吗？',
    positiveText: '退出',
    negativeText: '取消',
    onPositiveClick: async () => {
      const result = await api.post<any>('/api/teams/leave');
      message.success(result.disbanded ? '队伍已解散' : '已退出队伍');
      router.push('/teams');
    },
  });
}

async function rotateCode() {
  const data = await api.post<any>(`/api/teams/${team.value.id}/invite-code`);
  message.success(`新邀请码：${data.inviteCode}`);
  await load();
}

async function kick(userId: number, name: string) {
  dialog.warning({
    title: '移出成员',
    content: `确定把 ${name} 移出队伍吗？`,
    positiveText: '移出',
    negativeText: '取消',
    onPositiveClick: async () => {
      await api.post(`/api/teams/${team.value.id}/kick/${userId}`);
      message.success('已移出');
      await load();
    },
  });
}

onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <div v-if="team" class="space-y-4">
      <n-card>
        <button class="back-btn" title="返回团队列表" style="margin-bottom: 12px" @click="router.push('/teams')">←</button>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xl font-bold">{{ team.name }}</h1>
              <n-tag v-if="team.locked" size="small" type="warning">已锁定</n-tag>
              <n-tag v-if="team.hidden" size="small">已隐藏</n-tag>
            </div>
            <p class="mt-1 text-sm opacity-70">{{ team.affiliation || '未填写单位' }}</p>
            <p class="mt-2 max-w-2xl text-sm opacity-70">{{ team.description || '这支队伍还没有写介绍' }}</p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-indigo-500">{{ team.score }}</div>
            <div class="text-xs opacity-50">队伍总分</div>
          </div>
        </div>
        <n-space v-if="team.isMine" class="mt-4">
          <n-button size="small" @click="editing = !editing">{{ editing ? '取消编辑' : '编辑资料' }}</n-button>
          <n-button v-if="team.isCaptain" size="small" @click="rotateCode">重置邀请码</n-button>
          <n-button size="small" type="error" ghost @click="leave">退出队伍</n-button>
        </n-space>
        <div v-if="team.inviteCode" class="mt-3 text-sm">
          邀请码：<code class="rounded bg-black/5 px-2 py-0.5">{{ team.inviteCode }}</code>
        </div>
      </n-card>

      <n-card v-if="editing" title="编辑队伍资料">
        <n-space vertical>
          <n-input v-model:value="editForm.name" placeholder="队伍名称" />
          <n-input v-model:value="editForm.affiliation" placeholder="学校 / 单位" />
          <n-input v-model:value="editForm.description" type="textarea" placeholder="队伍介绍" />
          <n-button type="primary" @click="save">保存</n-button>
        </n-space>
      </n-card>

      <div class="grid gap-4 lg:grid-cols-2">
        <n-card title="成员">
          <n-list>
            <n-list-item v-for="m in team.members" :key="m.id">
              <n-thing :title="m.displayName">
                <template #description>
                  @{{ m.username }} · {{ m.score }} 分
                  <n-tag v-if="m.captain" size="tiny" type="warning" class="ml-1">队长</n-tag>
                </template>
              </n-thing>
              <template #suffix>
                <n-button v-if="team.isCaptain && !m.captain" size="tiny" text type="error" @click="kick(m.id, m.displayName)">
                  移出
                </n-button>
              </template>
            </n-list-item>
          </n-list>
        </n-card>

        <n-card title="解题记录">
          <n-empty v-if="!team.solves?.length" description="还没有解出题目" />
          <n-list v-else>
            <n-list-item v-for="s in team.solves" :key="s.id">
              <n-space align="center">
                <RouterLink :to="`/challenges/${s.challengeId}`" class="hover:underline">{{ s.title }}</RouterLink>
                <n-tag size="tiny" type="success">+{{ s.score }}</n-tag>
                <span class="ml-auto text-xs opacity-50">{{ new Date(s.createdAt).toLocaleString() }}</span>
              </n-space>
            </n-list-item>
          </n-list>
        </n-card>
      </div>
    </div>
  </n-spin>
</template>
