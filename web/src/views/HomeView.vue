<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { NSpin } from 'naive-ui';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import ChallengeCard from '../components/ChallengeCard.vue';
import MarkdownView from '../components/MarkdownView.vue';

const auth = useAuthStore();
const loading = ref(true);
const stats = ref({ users: 0, teams: 0, challenges: 0, solves: 0, competitions: 0 });
const challenges = ref<any[]>([]);
const competitions = ref<any[]>([]);
const bloods = ref<any[]>([]);
const announcements = ref<any[]>([]);
const expandedAnn = ref<Set<number>>(new Set());

const LEVEL_LABEL: Record<string, string> = { INFO: 'NOTICE', WARNING: 'WARN', IMPORTANT: 'IMPORTANT' };
const LEVEL_COLOR: Record<string, string> = {
  INFO: 'var(--jk-text-2)',
  WARNING: 'var(--jk-amber)',
  IMPORTANT: 'var(--jk-danger)',
};

function toggleAnn(id: number) {
  const next = new Set(expandedAnn.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedAnn.value = next;
}

const STATE: Record<string, { text: string; color: string }> = {
  UPCOMING: { text: '即将开始', color: '#3ba0ff' },
  RUNNING: { text: '进行中', color: '#00e5a0' },
  FROZEN: { text: '封榜中', color: '#ffb020' },
  ENDED: { text: '已结束', color: '#6f7a93' },
};

onMounted(async () => {
  try {
    const [s, c, comp, b] = await Promise.all([
      api.get<any>('/api/scoreboard/stats'),
      api.get<any>('/api/challenges?size=9'),
      api.get<any>('/api/competitions?size=5'),
      api.get<any>('/api/scoreboard/bloods?limit=6'),
    ]);
    stats.value = s;
    challenges.value = c.items ?? [];
    competitions.value = comp.items ?? [];
    bloods.value = b.items ?? [];
    announcements.value = await api
      .get<any>('/api/site/announcements?size=20')
      .then((d) => d.items ?? [])
      .catch(() => []);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <n-spin :show="loading">
    <div class="jk-page">
      <!-- 首屏 -->
      <section class="jk-hero">
        <div class="jk-prompt">
          <b>root@{{ String(auth.siteName).toLowerCase() }}</b>
          <span>:~$</span>
          <span>./start_challenge --mode=ctf</span>
          <span class="cursor" />
        </div>
        <h1>{{ String(auth.siteName).toUpperCase() }}<span>_</span></h1>
        <p>{{ auth.meta?.settings['site.description'] || '一个开源的 CTF 竞赛平台' }}</p>
        <div class="jk-hero-actions">
          <RouterLink to="/challenges" class="jk-hero-btn solid">开始答题</RouterLink>
          <RouterLink to="/competitions" class="jk-hero-btn">比赛列表</RouterLink>
          <RouterLink v-if="!auth.isLogin" to="/register" class="jk-hero-btn">注册账号</RouterLink>
        </div>
      </section>

      <!-- 数据 -->
      <section class="jk-stats">
        <div class="jk-stat"><div class="jk-stat-label">Operators</div><div class="jk-stat-value">{{ stats.users }}</div></div>
        <div class="jk-stat"><div class="jk-stat-label">Challenges</div><div class="jk-stat-value">{{ stats.challenges }}</div></div>
        <div class="jk-stat"><div class="jk-stat-label">Solves</div><div class="jk-stat-value">{{ stats.solves }}</div></div>
        <div class="jk-stat"><div class="jk-stat-label">Teams</div><div class="jk-stat-value">{{ stats.teams }}</div></div>
        <div class="jk-stat"><div class="jk-stat-label">Events</div><div class="jk-stat-value">{{ stats.competitions }}</div></div>
      </section>

      <!-- 公告 -->
      <section v-if="announcements.length" class="jk-panel">
        <div class="jk-section"><h2>公告</h2><span class="count">{{ announcements.length }}</span></div>
        <div v-for="item in announcements" :key="item.id" class="ann-item">
          <div class="ann-head" @click="toggleAnn(Number(item.id))">
            <span
              class="jk-chip"
              :style="{ color: LEVEL_COLOR[item.level] ?? 'var(--jk-text-2)', borderColor: 'var(--jk-border-strong)' }"
            >
              {{ item.pinned ? 'PIN' : LEVEL_LABEL[item.level] ?? 'NOTICE' }}
            </span>
            <h3>{{ item.title }}</h3>
            <span class="mono ann-date">{{ new Date(item.publishedAt).toLocaleDateString() }}</span>
            <span class="ann-toggle">{{ expandedAnn.has(Number(item.id)) ? '收起' : '展开' }}</span>
          </div>
          <div v-if="expandedAnn.has(Number(item.id))" class="ann-body">
            <MarkdownView :content="item.content" />
          </div>
        </div>
      </section>

      <div class="home-grid">
        <section>
          <div class="jk-section">
            <h2>题目</h2>
            <RouterLink to="/challenges" class="more">全部 →</RouterLink>
          </div>
          <div v-if="!challenges.length" class="jk-empty">
            <div class="jk-empty-icon">□</div>
            <div>// 还没有题目</div>
          </div>
          <div v-else class="jk-grid">
            <ChallengeCard v-for="item in challenges" :key="item.id" :challenge="item" show-category />
          </div>
        </section>

        <aside style="display: flex; flex-direction: column; gap: 18px">
          <section class="jk-panel">
            <div class="jk-section"><h2>赛事</h2><RouterLink to="/competitions" class="more">更多</RouterLink></div>
            <div v-if="!competitions.length" class="jk-empty" style="padding: 26px 12px; border: none">
              <div class="mono" style="font-size: 12px">// 暂无比赛</div>
            </div>
            <RouterLink
              v-for="item in competitions"
              :key="item.id"
              :to="`/competitions/${item.slug}`"
              class="jk-list-item"
              style="text-decoration: none; color: inherit"
            >
              <div style="min-width: 0; flex: 1">
                <div style="font-weight: 600; font-size: 13.5px">{{ item.name }}</div>
                <div class="mono" style="font-size: 11px; color: var(--jk-muted); margin-top: 2px">
                  {{ new Date(item.startAt).toLocaleDateString() }} · {{ item.participantCount ?? 0 }} 人
                </div>
              </div>
              <span class="jk-chip" :style="{ color: STATE[item.status]?.color, borderColor: STATE[item.status]?.color + '55' }">
                {{ STATE[item.status]?.text }}
              </span>
            </RouterLink>
          </section>

          <section class="jk-panel">
            <div class="jk-section"><h2>一血</h2></div>
            <div v-if="!bloods.length" class="jk-empty" style="padding: 26px 12px; border: none">
              <div class="mono" style="font-size: 12px">// 还没有一血</div>
            </div>
            <div v-for="item in bloods" :key="item.id" class="jk-list-item">
              <span class="jk-chip" style="color: #ff4d6d; border-color: rgba(255, 77, 109, 0.4)">1ST</span>
              <div style="min-width: 0; flex: 1">
                <div style="font-size: 13px; font-weight: 600">{{ item.user.displayName }}</div>
                <div class="mono" style="font-size: 11px; color: var(--jk-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                  {{ item.challenge.title }}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  </n-spin>
</template>

<style scoped>
.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 18px;
}

@media (max-width: 1024px) {
  .home-grid {
    grid-template-columns: 1fr;
  }
}
</style>
