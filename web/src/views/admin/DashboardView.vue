<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NGrid, NGi, NStatistic, NSpin, NList, NListItem, NThing, NTag, NSpace } from 'naive-ui';
import { api } from '../../api';

const loading = ref(true);
const data = ref<any>(null);

onMounted(async () => {
  try {
    data.value = await api.get<any>('/api/admin/dashboard');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <n-spin :show="loading">
    <div v-if="data" class="space-y-4">
      <n-grid :cols="4" :x-gap="12" :y-gap="12" responsive="screen" item-responsive>
        <n-gi span="4 s:4 m:1"><n-card size="small"><n-statistic label="注册用户" :value="data.users.total"><template #suffix><span class="text-xs opacity-60">本周 +{{ data.users.newWeek }}</span></template></n-statistic></n-card></n-gi>
        <n-gi span="4 s:4 m:1"><n-card size="small"><n-statistic label="题目" :value="data.challenges.total"><template #suffix><span class="text-xs opacity-60">可见 {{ data.challenges.visible }}</span></template></n-statistic></n-card></n-gi>
        <n-gi span="4 s:4 m:1"><n-card size="small"><n-statistic label="解题总数" :value="data.solves.total"><template #suffix><span class="text-xs opacity-60">今日 {{ data.solves.today }}</span></template></n-statistic></n-card></n-gi>
        <n-gi span="4 s:4 m:1"><n-card size="small"><n-statistic label="队伍" :value="data.teams.total" /></n-card></n-gi>
      </n-grid>

      <n-grid :cols="3" :x-gap="12" :y-gap="12" responsive="screen" item-responsive>
        <n-gi span="3 s:3 m:1">
          <n-card size="small" title="待处理">
            <n-space vertical :size="6">
              <div class="flex justify-between"><span>未处理工单</span><n-tag :type="data.tickets.open ? 'warning' : 'default'" size="small">{{ data.tickets.open }}</n-tag></div>
              <div class="flex justify-between"><span>待审题解</span><n-tag :type="data.writeups.pending ? 'warning' : 'default'" size="small">{{ data.writeups.pending }}</n-tag></div>
              <div class="flex justify-between"><span>进行中比赛</span><n-tag :type="data.competitions.running ? 'success' : 'default'" size="small">{{ data.competitions.running }}</n-tag></div>
            </n-space>
          </n-card>
        </n-gi>
        <n-gi span="3 s:3 m:1">
          <n-card size="small" title="运行状态">
            <n-space vertical :size="6">
              <div class="flex justify-between"><span>Redis</span><n-tag :type="data.redis === 'ready' ? 'success' : 'warning'" size="small">{{ data.redis }}</n-tag></div>
              <div class="flex justify-between"><span>靶机运行中</span><span>{{ data.docker?.running ?? 0 }} / {{ data.docker?.total ?? 0 }}</span></div>
              <div class="flex justify-between"><span>用户封禁</span><span>{{ data.users.banned }}</span></div>
            </n-space>
          </n-card>
        </n-gi>
        <n-gi span="3 s:3 m:1">
          <n-card size="small" title="等级分榜前 5">
            <n-list>
              <n-list-item v-for="(u, i) in data.topUsers" :key="u.id">
                <n-space align="center"><n-tag size="tiny">{{ i + 1 }}</n-tag><span>{{ u.displayName || u.username }}</span><span class="ml-auto font-medium">{{ u.rating }}</span></n-space>
              </n-list-item>
            </n-list>
          </n-card>
        </n-gi>
      </n-grid>

      <n-card size="small" title="近 14 天解题趋势">
        <div class="flex h-32 items-end gap-1">
          <div v-for="d in data.trend" :key="d.day" class="flex flex-1 flex-col items-center gap-1">
            <div class="w-full rounded-t bg-indigo-400" :style="{ height: `${Math.min(100, (d.count / Math.max(1, ...data.trend.map((x: any) => x.count))) * 100)}%`, minHeight: '3px' }" />
            <span class="text-[10px] opacity-50">{{ d.day.slice(5) }}</span>
          </div>
        </div>
      </n-card>

      <n-card size="small" title="最近操作">
        <n-list>
          <n-list-item v-for="a in data.recentActions" :key="a.id">
            <n-thing>
              <template #description>
                <n-space align="center" :size="6">
                  <span class="font-mono text-xs">{{ a.action }}</span>
                  <span class="text-xs">{{ a.actorName }}</span>
                  <span class="ml-auto text-xs opacity-50">{{ new Date(a.createdAt).toLocaleString() }}</span>
                </n-space>
              </template>
            </n-thing>
          </n-list-item>
        </n-list>
      </n-card>
    </div>
  </n-spin>
</template>
