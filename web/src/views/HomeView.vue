<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { NSpin } from 'naive-ui';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import ChallengeCard from '../components/ChallengeCard.vue';

const auth = useAuthStore();
const loading = ref(true);
const stats = ref({ users: 0, teams: 0, challenges: 0, solves: 0, competitions: 0 });
const challenges = ref<any[]>([]);
const competitions = ref<any[]>([]);
const bloods = ref<any[]>([]);

const STATE_LABEL: Record<string, { text: string; color: string }> = {
  UPCOMING: { text: '未开始', color: '#3b82f6' },
  RUNNING: { text: '进行中', color: '#16a34a' },
  FROZEN: { text: '封榜中', color: '#f59e0b' },
  ENDED: { text: '已结束', color: '#94a3b8' },
};

onMounted(async () => {
  try {
    const [s, c, comp, b] = await Promise.all([
      api.get<any>('/api/scoreboard/stats'),
      api.get<any>('/api/challenges?size=8'),
      api.get<any>('/api/competitions?size=4'),
      api.get<any>('/api/scoreboard/bloods?limit=6'),
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
    <div class="jk-page">
      <!-- 横幅 -->
      <section class="jk-hero">
        <h1>{{ auth.siteName }}</h1>
        <p>{{ auth.meta?.settings['site.description'] || '一个开源的 CTF 竞赛平台' }}</p>
        <div class="jk-hero-actions">
          <RouterLink to="/challenges" class="jk-hero-btn solid">开始答题</RouterLink>
          <RouterLink to="/competitions" class="jk-hero-btn ghost">查看比赛</RouterLink>
          <RouterLink v-if="!auth.isLogin" to="/register" class="jk-hero-btn ghost">注册账号</RouterLink>
        </div>
      </section>

      <!-- 公告 -->
      <section v-if="auth.meta?.announcements?.length" class="jk-panel">
        <div class="jk-section">
          <h2>站内公告</h2>
        </div>
        <div v-for="item in auth.meta.announcements.slice(0, 3)" :key="item.id" class="jk-list-item" style="align-items: flex-start">
          <span
            class="jk-chip"
            :style="item.level === 'IMPORTANT' ? 'color:#e11d48;border-color:rgba(225,29,72,.35)' : item.level === 'WARNING' ? 'color:#b45309;border-color:rgba(245,158,11,.35)' : ''"
          >
            {{ item.pinned ? '置顶' : item.level === 'INFO' ? '公告' : item.level }}
          </span>
          <div style="min-width: 0; flex: 1">
            <div style="font-weight: 600">{{ item.title }}</div>
            <div style="font-size: 13px; color: var(--jk-muted); margin-top: 2px">{{ item.content.slice(0, 120) }}</div>
          </div>
          <span style="font-size: 12px; color: var(--jk-muted); flex: none">
            {{ new Date(item.publishedAt).toLocaleDateString() }}
          </span>
        </div>
      </section>

      <!-- 数据 -->
      <section class="jk-stats">
        <div class="jk-stat"><div class="jk-stat-label">注册用户</div><div class="jk-stat-value">{{ stats.users }}</div></div>
        <div class="jk-stat"><div class="jk-stat-label">题目数量</div><div class="jk-stat-value">{{ stats.challenges }}</div></div>
        <div class="jk-stat"><div class="jk-stat-label">解题总数</div><div class="jk-stat-value">{{ stats.solves }}</div></div>
        <div class="jk-stat"><div class="jk-stat-label">队伍数量</div><div class="jk-stat-value">{{ stats.teams }}</div></div>
        <div class="jk-stat"><div class="jk-stat-label">举办比赛</div><div class="jk-stat-value">{{ stats.competitions }}</div></div>
      </section>

      <div style="display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr) 340px">
        <!-- 最新题目 -->
        <section>
          <div class="jk-section">
            <h2>最新题目</h2>
            <RouterLink to="/challenges" class="more">全部 →</RouterLink>
          </div>
          <div v-if="!challenges.length" class="jk-empty">
            <div class="jk-empty-icon">📭</div>
            <div>还没有题目</div>
          </div>
          <div v-else class="jk-grid">
            <ChallengeCard v-for="item in challenges" :key="item.id" :challenge="item" show-category />
          </div>
        </section>

        <!-- 侧栏 -->
        <aside style="display: flex; flex-direction: column; gap: 20px">
          <section class="jk-panel">
            <div class="jk-section"><h2>近期比赛</h2></div>
            <div v-if="!competitions.length" class="jk-empty" style="padding: 28px 12px; border: none">
              <div class="jk-empty-icon">🏁</div>
              <div>暂无比赛</div>
            </div>
            <RouterLink
              v-for="item in competitions"
              :key="item.id"
              :to="`/competitions/${item.slug}`"
              class="jk-list-item"
              style="text-decoration: none; color: inherit"
            >
              <div style="min-width: 0; flex: 1">
                <div style="font-weight: 600; font-size: 14px">{{ item.name }}</div>
                <div style="font-size: 12px; color: var(--jk-muted); margin-top: 2px">
                  {{ new Date(item.startAt).toLocaleDateString() }} · {{ item.participantCount ?? 0 }} 人报名
                </div>
              </div>
              <span
                class="jk-chip"
                :style="{ color: STATE_LABEL[item.status]?.color, borderColor: STATE_LABEL[item.status]?.color + '55' }"
              >
                {{ STATE_LABEL[item.status]?.text }}
              </span>
            </RouterLink>
          </section>

          <section class="jk-panel">
            <div class="jk-section"><h2>最新一血</h2></div>
            <div v-if="!bloods.length" class="jk-empty" style="padding: 28px 12px; border: none">
              <div class="jk-empty-icon">🩸</div>
              <div>还没有一血</div>
            </div>
            <div v-for="item in bloods" :key="item.id" class="jk-list-item">
              <span class="jk-chip" style="color: #e11d48; border-color: rgba(225, 29, 72, 0.35)">1st</span>
              <div style="min-width: 0; flex: 1">
                <div style="font-size: 13px; font-weight: 600">{{ item.user.displayName }}</div>
                <div style="font-size: 12px; color: var(--jk-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
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
