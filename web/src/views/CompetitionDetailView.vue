<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  NCard, NTag, NSpace, NButton, NSpin, NAlert, NTabs, NTabPane, NDataTable, NEmpty,
  NInput, NModal, NCarousel, NDescriptions, NDescriptionsItem, useMessage,
} from 'naive-ui';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import { DIFFICULTY_META } from '../theme';
import MarkdownView from '../components/MarkdownView.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const message = useMessage();

const loading = ref(true);
const competition = ref<any>(null);
const challenges = ref<any[]>([]);
const scoreboard = ref<any>(null);
const participants = ref<any[]>([]);
const joinOpen = ref(false);
const joinPassword = ref('');
const boardType = ref<'user' | 'team'>('user');

const now = ref(Date.now());
setInterval(() => (now.value = Date.now()), 1000);

const countdown = computed(() => {
  if (!competition.value) return '';
  const target = competition.value.status === 'UPCOMING' ? competition.value.startAt : competition.value.endAt;
  const diff = new Date(target).getTime() - now.value;
  if (diff <= 0) return competition.value.status === 'UPCOMING' ? '即将开始' : '已结束';
  const d = Math.floor(diff / 86400000);
  const hh = Math.floor((diff % 86400000) / 3600000);
  const mm = Math.floor((diff % 3600000) / 60000);
  const ss = Math.floor((diff % 60000) / 1000);
  return `${d > 0 ? d + ' 天 ' : ''}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
});

async function load() {
  loading.value = true;
  try {
    competition.value = await api.get<any>(`/api/competitions/${route.params.id}`);
    const id = competition.value.id;
    const [c, s, p] = await Promise.all([
      api.get<any>(`/api/competitions/${id}/challenges`).catch(() => ({ items: [] })),
      api.get<any>(`/api/competitions/${id}/scoreboard${boardType.value === 'team' ? '?type=team' : ''}`).catch(() => ({ items: [] })),
      api.get<any>(`/api/competitions/${id}/participants`).catch(() => ({ items: [] })),
    ]);
    challenges.value = c.items ?? [];
    scoreboard.value = s;
    participants.value = p.items ?? [];
  } finally {
    loading.value = false;
  }
}

async function register() {
  try {
    const result = await api.post<any>(`/api/competitions/${competition.value.id}/register`, { password: joinPassword.value });
    message.success(result.status === 'PENDING' ? '已提交申请，等待审核' : '报名成功');
    joinOpen.value = false;
    await load();
  } catch (err: any) {
    message.error(err?.message ?? '报名失败');
  }
}

const boardColumns = [
  { title: '#', key: 'rank', width: 70, render: (r: any) => (r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank) },
  { title: '名称', key: 'name' },
  { title: '总分', key: 'score', width: 100 },
  { title: '解题数', key: 'solveCount', width: 90 },
  { title: '最后解出', key: 'lastSolveAt', width: 180, render: (r: any) => (r.lastSolveAt ? new Date(r.lastSolveAt).toLocaleString() : '—') },
];

watch(boardType, async () => {
  scoreboard.value = await api.get<any>(`/api/competitions/${competition.value.id}/scoreboard?type=${boardType.value}`);
});
watch(() => route.params.id, load);
onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <div v-if="competition" class="space-y-4">
      <n-card>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-bold">{{ competition.name }}</h1>
              <n-tag size="small" :type="({ RUNNING: 'success', FROZEN: 'warning', UPCOMING: 'info' } as any)[competition.status] ?? 'default'">
                {{ { UPCOMING: '未开始', RUNNING: '进行中', FROZEN: '封榜中', ENDED: '已结束' }[competition.status as string] }}
              </n-tag>
              <n-tag size="small" :bordered="false">{{ { JEOPARDY: '解题赛', AWD: '攻防赛', MIXED: '混合赛' }[competition.type as string] }}</n-tag>
              <n-tag size="small" :bordered="false">{{ { SOLO: '个人', TEAM: '团队', BOTH: '个人/团队' }[competition.teamMode as string] }}</n-tag>
            </div>
            <p class="mt-1 text-sm opacity-70">{{ competition.subtitle || competition.description }}</p>
          </div>
          <div class="text-right">
            <div class="text-xs opacity-60">{{ competition.status === 'UPCOMING' ? '距离开赛' : '距离结束' }}</div>
            <div class="font-mono text-xl font-semibold text-indigo-500">{{ countdown }}</div>
            <n-space class="mt-2" justify="end">
              <n-button v-if="competition.type !== 'JEOPARDY'" size="small" @click="router.push(`/competitions/${competition.id}/awd`)">
                AWD 面板
              </n-button>
              <n-button v-if="!competition.joined && competition.status !== 'ENDED'" size="small" type="primary" :disabled="!auth.isLogin" @click="joinOpen = true">
                报名参赛
              </n-button>
              <n-tag v-else-if="competition.joined" type="success">已报名</n-tag>
            </n-space>
          </div>
        </div>
      </n-card>

      <n-tabs type="line" animated>
        <n-tab-pane name="challenges" tab="题目">
          <n-alert v-if="competition.status === 'UPCOMING' && !challenges.length" type="info">
            比赛尚未开始，题目将在开赛时公布
          </n-alert>
          <n-empty v-else-if="!challenges.length" description="这场比赛还没有题目" class="py-12" />
          <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <n-card v-for="item in challenges" :key="item.id" size="small" hoverable @click="router.push(`/challenges/${item.id}`)">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="truncate font-medium">
                    <span v-if="item.solved" class="mr-1 text-emerald-500">✓</span>{{ item.title }}
                  </div>
                  <n-space class="mt-1" :size="4">
                    <n-tag size="tiny" :color="({ color: (DIFFICULTY_META[item.difficulty]?.color ?? '#888') + '22', textColor: DIFFICULTY_META[item.difficulty]?.color, borderColor: 'transparent' })">
                      {{ DIFFICULTY_META[item.difficulty]?.label }}
                    </n-tag>
                    <n-tag v-if="item.category" size="tiny" :bordered="false">{{ item.category.name }}</n-tag>
                  </n-space>
                </div>
                <div class="shrink-0 text-right">
                  <div class="font-semibold text-indigo-500">{{ item.currentValue }}</div>
                  <div class="text-xs opacity-50">{{ item.solveCount }} 解出</div>
                </div>
              </div>
            </n-card>
          </div>
        </n-tab-pane>

        <n-tab-pane name="scoreboard" tab="排行榜">
          <n-alert v-if="scoreboard?.notice" type="warning" class="mb-3">{{ scoreboard.notice }}</n-alert>
          <n-space class="mb-3" v-if="competition.teamMode === 'BOTH'">
            <n-button size="small" :type="boardType === 'user' ? 'primary' : 'default'" @click="boardType = 'user'">个人</n-button>
            <n-button size="small" :type="boardType === 'team' ? 'primary' : 'default'" @click="boardType = 'team'">团队</n-button>
          </n-space>
          <n-empty v-if="!scoreboard?.items?.length" description="还没有队伍解出题目" class="py-12" />
          <n-data-table v-else :columns="boardColumns" :data="scoreboard.items" :bordered="false" size="small" />
        </n-tab-pane>

        <n-tab-pane name="participants" tab="参赛名单">
          <n-empty v-if="!participants.length" description="还没有人报名" class="py-12" />
          <div v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <n-card v-for="p in participants" :key="p.id" size="small">
              <n-space align="center">
                <RouterLink :to="`/users/${p.user.username}`" class="font-medium hover:underline">
                  {{ p.user.displayName }}
                </RouterLink>
                <n-tag v-if="p.team" size="tiny" :bordered="false">{{ p.team.name }}</n-tag>
                <span class="ml-auto text-sm font-semibold text-indigo-500">{{ p.score }}</span>
              </n-space>
            </n-card>
          </div>
        </n-tab-pane>

        <n-tab-pane name="rules" tab="规则">
          <MarkdownView :content="competition.rules || competition.description" />
          <n-empty v-if="!competition.rules && !competition.description" description="组织者还没有写规则" class="py-12" />
        </n-tab-pane>

        <n-tab-pane v-if="competition.announcements?.length" name="announcements" tab="比赛公告">
          <div v-for="a in competition.announcements" :key="a.id" class="border-b border-dashed py-3 last:border-0">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ a.title }}</span>
              <span class="ml-auto text-xs opacity-50">{{ new Date(a.createdAt).toLocaleString() }}</span>
            </div>
            <MarkdownView :content="a.content" />
          </div>
        </n-tab-pane>
      </n-tabs>

      <n-modal v-model:show="joinOpen" preset="card" title="报名参赛" style="max-width: 420px">
        <p class="text-sm opacity-70">
          {{ competition.teamMode === 'TEAM' ? '这场比赛需要组队参加，请先创建或加入队伍。' : '确认报名这场比赛？' }}
        </p>
        <n-input v-if="competition.joinPassword" v-model:value="joinPassword" class="mt-3" placeholder="请输入参赛口令" />
        <template #footer>
          <n-space justify="end">
            <n-button @click="joinOpen = false">取消</n-button>
            <n-button type="primary" @click="register">确认报名</n-button>
          </n-space>
        </template>
      </n-modal>
    </div>
  </n-spin>
</template>
