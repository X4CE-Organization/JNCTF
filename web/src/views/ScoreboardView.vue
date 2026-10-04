<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NSpin, NAvatar } from 'naive-ui';
import { RouterLink } from 'vue-router';
import { api, query } from '../api';

const type = ref<'user' | 'team'>('user');
const loading = ref(false);
const items = ref<any[]>([]);

const podium = computed(() => items.value.slice(0, 3));
const rest = computed(() => items.value.slice(3));
const medals = ['🥇', '🥈', '🥉'];

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>(`/api/scoreboard${query({ type: type.value, limit: 200 })}`);
    items.value = data.items ?? [];
  } finally {
    loading.value = false;
  }
}

watch(type, load);
onMounted(load);
</script>

<template>
  <div class="jk-page">
    <header class="jk-head">
      <span class="jk-head-icon">🏆</span>
      <div>
        <h1>排行榜</h1>
        <p>共 {{ items.length }} 位{{ type === 'user' ? '选手' : '队伍' }}，同分按最后解出时间排序</p>
      </div>
      <div class="jk-head-actions">
        <div class="seg">
          <button :class="type === 'user' ? 'on' : ''" @click="type = 'user'">个人榜</button>
          <button :class="type === 'team' ? 'on' : ''" @click="type = 'team'">团队榜</button>
        </div>
      </div>
    </header>

    <n-spin :show="loading">
      <div v-if="!items.length && !loading" class="jk-empty">
        <div class="jk-empty-icon">🏅</div>
        <div>还没有人解出题目</div>
      </div>

      <template v-else>
        <div class="jk-podium">
          <div v-for="(entry, index) in podium" :key="entry.id" class="jk-podium-card" :class="`rank-${index + 1}`">
            <span class="jk-podium-medal">{{ medals[index] }}</span>
            <n-avatar round :size="38" :src="entry.avatar || undefined">{{ entry.name.slice(0, 1) }}</n-avatar>
            <div style="min-width: 0">
              <div class="jk-podium-name">
                <RouterLink :to="type === 'team' ? `/teams/${entry.id}` : `/users/${entry.name}`" style="color: inherit; text-decoration: none">
                  {{ entry.name }}
                </RouterLink>
              </div>
              <div class="jk-podium-score">{{ entry.score }} 分 · {{ entry.solveCount }} 题</div>
            </div>
          </div>
        </div>

        <div class="jk-panel" style="padding: 0; overflow: hidden">
          <table class="jk-table">
            <thead>
              <tr>
                <th style="width: 80px">名次</th>
                <th>{{ type === 'user' ? '选手' : '队伍' }}</th>
                <th style="width: 110px">总分</th>
                <th style="width: 100px">解题数</th>
                <th style="width: 190px">最后解出</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in rest" :key="entry.id">
                <td><span class="jk-rank" :class="entry.rank <= 3 ? `r${entry.rank}` : ''">{{ entry.rank }}</span></td>
                <td>
                  <div style="display: flex; align-items: center; gap: 10px">
                    <n-avatar round :size="28" :src="entry.avatar || undefined">{{ entry.name.slice(0, 1) }}</n-avatar>
                    <RouterLink
                      :to="type === 'team' ? `/teams/${entry.id}` : `/users/${entry.name}`"
                      style="color: inherit; text-decoration: none; font-weight: 500"
                    >
                      {{ entry.name }}
                    </RouterLink>
                  </div>
                </td>
                <td style="font-weight: 700; color: var(--jk-primary)">{{ entry.score }}</td>
                <td>{{ entry.solveCount }}</td>
                <td style="color: var(--jk-muted); font-size: 13px">
                  {{ entry.lastSolveAt ? new Date(entry.lastSolveAt).toLocaleString() : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </n-spin>
  </div>
</template>

<style scoped>
.seg {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  background: var(--jk-surface-2);
}
.seg button {
  padding: 6px 16px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--jk-text-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.seg button.on {
  background: var(--jk-surface);
  color: var(--jk-primary);
  font-weight: 600;
  box-shadow: var(--jk-shadow-sm);
}
</style>
