<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NGrid, NGi, NStatistic, NTag, NSpin, NEmpty, NSpace, NButton } from 'naive-ui';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import ChallengeCard from '../components/ChallengeCard.vue';

const auth = useAuthStore();
const router = useRouter();
const loading = ref(true);
const stats = ref({ users: 0, teams: 0, challenges: 0, solves: 0, competitions: 0 });
const challenges = ref<any[]>([]);
const competitions = ref<any[]>([]);
const bloods = ref<any[]>([]);

onMounted(async () => {
  try {
    const [s, c, comp, b] = await Promise.all([
      api.get<any>('/api/scoreboard/stats'),
      api.get<any>('/api/challenges?size=8'),
      api.get<any>('/api/competitions?size=4'),
      api.get<any>('/api/scoreboard/bloods?limit=8'),
    ]);
    stats.value = s;
    challenges.value = c.items ?? [];
    competitions.value = comp.items ?? [];
    bloods.value = b.items ?? [];
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <n-spin :show="loading">
    <div class="space-y-6">
      <!-- 顶部横幅 -->
      <n-card class="overflow-hidden !rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 text-white" :bordered="false">
        <div class="py-4">
          <h1 class="text-2xl font-bold sm:text-3xl">{{ auth.siteName }}</h1>
          <p class="mt-2 max-w-2xl text-sm opacity-90">
            {{ auth.meta?.settings['site.description'] || '一个开源的 CTF 竞赛平台' }}
          </p>
          <n-space class="mt-4">
            <n-button type="primary" color="#ffffff" text-color="#4f46e5" @click="router.push('/challenges')">
              开始答题
            </n-button>
            <n-button ghost @click="router.push('/competitions')">查看比赛</n-button>
          </n-space>
        </div>
      </n-card>

      <!-- 公告 -->
      <n-card v-if="auth.meta?.announcements?.length" size="small" title="站内公告">
        <div v-for="item in auth.meta.announcements.slice(0, 3)" :key="item.id" class="border-l-2 border-indigo-400 pl-3 py-1.5">
          <div class="flex items-center gap-2">
            <n-tag v-if="item.pinned" size="tiny" type="warning">置顶</n-tag>
            <span class="font-medium">{{ item.title }}</span>
            <span class="text-xs opacity-50">{{ new Date(item.publishedAt).toLocaleDateString() }}</span>
          </div>
          <p class="mt-1 line-clamp-2 text-sm opacity-70">{{ item.content }}</p>
        </div>
      </n-card>

      <!-- 统计 -->
      <n-grid :cols="5" :x-gap="12" :y-gap="12" responsive="screen" item-responsive>
        <n-gi span="5 s:5 m:1">
          <n-card size="small"><n-statistic label="注册用户" :value="stats.users" /></n-card>
        </n-gi>
        <n-gi span="5 s:5 m:1">
          <n-card size="small"><n-statistic label="题目数量" :value="stats.challenges" /></n-card>
        </n-gi>
        <n-gi span="5 s:5 m:1">
          <n-card size="small"><n-statistic label="解题总数" :value="stats.solves" /></n-card>
        </n-gi>
        <n-gi span="5 s:5 m:1">
          <n-card size="small"><n-statistic label="队伍数量" :value="stats.teams" /></n-card>
        </n-gi>
        <n-gi span="5 s:5 m:1">
          <n-card size="small"><n-statistic label="举办比赛" :value="stats.competitions" /></n-card>
        </n-gi>
      </n-grid>

      <div class="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div class="jnctf-section-title">
            <span>最新题目</span>
            <RouterLink to="/challenges" class="ml-auto text-xs text-indigo-500 hover:underline">全部 →</RouterLink>
          </div>
          <n-empty v-if="!challenges.length" description="还没有题目" />
          <div v-else class="grid gap-3 sm:grid-cols-2">
            <ChallengeCard v-for="item in challenges" :key="item.id" :challenge="item" show-category />
          </div>
        </div>

        <div class="space-y-4">
          <n-card size="small" title="近期比赛">
            <n-empty v-if="!competitions.length" size="small" description="暂无比赛" />
            <div v-for="item in competitions" :key="item.id" class="cursor-pointer border-b border-dashed py-2 last:border-0" @click="router.push(`/competitions/${item.slug}`)">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium">{{ item.name }}</span>
                <n-tag size="tiny" :type="item.status === 'RUNNING' ? 'success' : item.status === 'FROZEN' ? 'warning' : 'default'">
                  {{ { UPCOMING: '未开始', RUNNING: '进行中', FROZEN: '封榜中', ENDED: '已结束' }[item.status as string] }}
                </n-tag>
              </div>
              <div class="mt-1 text-xs opacity-60">
                {{ new Date(item.startAt).toLocaleString() }} 起 · {{ item.participantCount ?? 0 }} 人报名
              </div>
            </div>
          </n-card>

          <n-card size="small" title="最新一血">
            <n-empty v-if="!bloods.length" size="small" description="还没有一血" />
            <div v-for="item in bloods" :key="item.id" class="flex items-center gap-2 py-1.5 text-sm">
              <n-tag size="tiny" type="error">1st</n-tag>
              <span class="truncate font-medium">{{ item.user.displayName }}</span>
              <span class="truncate text-xs opacity-60">{{ item.challenge.title }}</span>
            </div>
          </n-card>
        </div>
      </div>
    </div>
  </n-spin>
</template>
