<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { NCard, NTag, NSpin, NEmpty, NInput, NButton, NSpace, NDataTable, NAlert, useMessage } from 'naive-ui';
import { useRoute } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const error = ref('');
const targets = ref<any[]>([]);
const round = ref<any>(null);
const board = ref<any[]>([]);
const attacks = ref<any[]>([]);
const flag = ref('');
const submitting = ref(false);

const boardColumns = [
  { title: '#', key: 'rank', width: 60 },
  { title: '队伍', key: 'teamName' },
  { title: '总分', key: 'score', width: 90 },
  { title: '攻击', key: 'attackScore', width: 80 },
  { title: '被攻破', key: 'lostFlags', width: 80 },
  { title: '存活服务', key: 'aliveServices', width: 100, render: (r: any) => `${r.aliveServices}/${r.totalServices}` },
];

const attackColumns = [
  { title: '回合', key: 'roundNo', width: 70 },
  { title: '服务', key: 'service', width: 120 },
  { title: '攻击方', key: 'attackerTeam' },
  { title: '被攻破方', key: 'victimTeam' },
  { title: '得分', key: 'attackerDelta', width: 80 },
  { title: '时间', key: 'createdAt', width: 170, render: (r: any) => new Date(r.createdAt).toLocaleString() },
];

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const id = route.params.id;
    if (auth.isLogin) {
      const mine = await api.get<any>(`/api/awd/competitions/${id}/my-targets`).catch((e) => {
        error.value = e?.message ?? '';
        return { items: [], round: null };
      });
      targets.value = mine.items ?? [];
      round.value = mine.round;
    }
    const [b, a] = await Promise.all([
      api.get<any>(`/api/awd/competitions/${id}/scoreboard`).catch(() => ({ items: [] })),
      auth.isLogin ? api.get<any>(`/api/awd/competitions/${id}/attacks`).catch(() => ({ items: [] })) : Promise.resolve({ items: [] }),
    ]);
    board.value = b.items ?? [];
    attacks.value = a.items ?? [];
  } finally {
    loading.value = false;
  }
}

async function attack() {
  if (!flag.value.trim()) return;
  submitting.value = true;
  try {
    const result = await api.post<any>(`/api/awd/competitions/${route.params.id}/attack`, { flag: flag.value.trim() });
    result.success ? message.success(result.message) : message.error(result.message);
    if (result.success) {
      flag.value = '';
      await load();
    }
  } catch (err: any) {
    message.error(err?.message ?? '提交失败');
  } finally {
    submitting.value = false;
  }
}

watch(() => route.params.id, load);
onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <div class="space-y-4">
      <n-card>
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-lg font-semibold">AWD 攻防面板</span>
          <n-tag v-if="round" type="success">第 {{ round.roundNo }} 回合进行中</n-tag>
          <n-tag v-else type="default">当前没有进行中的回合</n-tag>
          <span v-if="round" class="ml-auto text-xs opacity-60">
            本回合 {{ new Date(round.startAt).toLocaleTimeString() }} — {{ new Date(round.endAt).toLocaleTimeString() }}
          </span>
        </div>
      </n-card>

      <n-alert v-if="error" type="warning">{{ error }}</n-alert>

      <n-card v-if="auth.isLogin" title="我的靶机">
        <n-empty v-if="!targets.length" description="还没有分配靶机（需要先组队并报名）" />
        <div v-else class="grid gap-3 md:grid-cols-2">
          <n-card v-for="t in targets" :key="t.id" size="small" :bordered="true">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ t.serviceName }}</span>
              <n-tag size="tiny" :type="t.alive ? 'success' : 'error'">{{ t.alive ? '正常' : '异常' }}</n-tag>
              <n-tag size="tiny" :bordered="false">{{ t.status }}</n-tag>
            </div>
            <div class="mt-2 space-y-1 text-xs">
              <div>连接：<code>{{ t.connection || t.errorMessage || '未分配' }}</code></div>
              <div class="break-all">我的 flag：<code>{{ t.flag || '—' }}</code></div>
            </div>
          </n-card>
        </div>
      </n-card>

      <n-card title="提交别人的 flag">
        <n-space>
          <n-input v-model:value="flag" placeholder="flag{...}" style="width: 320px" :disabled="!auth.isLogin" @keyup.enter="attack" />
          <n-button type="primary" :loading="submitting" :disabled="!auth.isLogin" @click="attack">提交</n-button>
        </n-space>
      </n-card>

      <n-card title="实时榜">
        <n-empty v-if="!board.length" description="暂无数据" />
        <n-data-table v-else :columns="boardColumns" :data="board" :bordered="false" size="small" />
      </n-card>

      <n-card title="攻防记录">
        <n-empty v-if="!attacks.length" description="还没有攻击记录" />
        <n-data-table v-else :columns="attackColumns" :data="attacks" :bordered="false" size="small" />
      </n-card>
    </div>
  </n-spin>
</template>
