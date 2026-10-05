<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NButton, NInput, NPagination, NSelect, NSpin } from 'naive-ui';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import { SUBMISSION_META } from '../theme';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const items = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const size = 30;
const totalPages = ref(1);
const status = ref<string | null>(null);
const challengeFilter = ref<string | null>(null);
const mineOnly = ref(false);
const keyword = ref('');

const statusOptions = Object.entries(SUBMISSION_META).map(([value, meta]) => ({ label: meta.label, value }));

const challengeOptions = ref<{ label: string; value: string }[]>([]);

async function searchChallenges(q: string) {
  const data = await api
    .get<any>(`/api/challenges?size=20&keyword=${encodeURIComponent(q)}`)
    .catch(() => ({ items: [] }));
  challengeOptions.value = (data.items ?? []).map((c: any) => ({ label: `${c.id}. ${c.title}`, value: String(c.id) }));
}

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: String(page.value), size: String(size) });
    if (status.value) params.set('status', status.value);
    if (challengeFilter.value) params.set('challengeId', challengeFilter.value);
    if (mineOnly.value && auth.user) params.set('userId', String(auth.user.id));
    if (keyword.value.trim() && !mineOnly.value) params.set('username', keyword.value.trim());

    const data = await api.get<any>(`/api/submissions/public?${params.toString()}`);
    items.value = data.items ?? [];
    total.value = data.total ?? 0;
    totalPages.value = data.totalPages ?? 1;
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  page.value = 1;
  load();
}

const statusMeta = (s: string) => SUBMISSION_META[s] ?? { label: s, type: 'info' as const };

const activeChallengeId = computed(() => (route.query.challengeId ? String(route.query.challengeId) : null));

watch(
  () => route.query.challengeId,
  (value) => {
    challengeFilter.value = value ? String(value) : null;
    page.value = 1;
    load();
  },
);

onMounted(async () => {
  if (route.query.challengeId) challengeFilter.value = String(route.query.challengeId);
  if (route.query.status) status.value = String(route.query.status);
  if (route.query.mine === '1' && auth.isLogin) mineOnly.value = true;
  await searchChallenges('');
  await load();
});
</script>

<template>
  <n-spin :show="loading">
    <div class="jk-page">
      <header class="jk-head">
        <button class="back-btn" title="返回上一页" @click="router.back()">←</button>
        <span class="jk-head-icon">&gt;_</span>
        <div style="min-width: 0">
          <h1>提交记录</h1>
          <p>
            <span>共 {{ total }} 条</span>
            <span v-if="activeChallengeId"> · 已按题目筛选</span>
          </p>
        </div>
        <div class="jk-head-actions">
          <router-link v-if="auth.isLogin" to="/challenges" class="ghost-link">去答题</router-link>
        </div>
      </header>

      <section class="jk-panel">
        <div class="filter-bar">
          <n-select
            v-model:value="challengeFilter"
            :options="challengeOptions"
            filterable
            clearable
            remote
            placeholder="按题目筛选"
            style="width: 260px"
            @search="searchChallenges"
            @update:value="applyFilters"
          />
          <n-select
            v-model:value="status"
            :options="statusOptions"
            clearable
            placeholder="按状态筛选"
            style="width: 160px"
            @update:value="applyFilters"
          />
          <n-input v-model:value="keyword" placeholder="搜索选手用户名" clearable style="width: 200px" @keyup.enter="applyFilters">
            <template #suffix>
              <button class="jk-mini-btn" @click="applyFilters">搜索</button>
            </template>
          </n-input>
          <n-button v-if="auth.isLogin" size="small" :type="mineOnly ? 'primary' : 'default'" @click="mineOnly = !mineOnly; applyFilters()">
            只看我的
          </n-button>
        </div>

        <div class="table-scroll">
        <table class="jk-table">
          <thead>
            <tr>
              <th style="width: 76px">编号</th>
              <th>题目</th>
              <th style="width: 190px">选手</th>
              <th style="width: 96px">状态</th>
              <th style="width: 82px">得分</th>
              <th style="width: 168px">时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="row.id">
              <td class="mono" style="color: var(--jk-muted)">#{{ row.id }}</td>
              <td>
                <RouterLink :to="`/challenges/${row.challengeId}`" class="table-link">{{ row.challengeTitle }}</RouterLink>
              </td>
              <td>
                <RouterLink :to="`/users/${row.user.username}`" class="table-link">@{{ row.user.username }}</RouterLink>
              </td>
              <td>
                <span class="status-pill" :class="`s-${row.status.toLowerCase()}`">{{ statusMeta(row.status).label }}</span>
              </td>
              <td class="mono">{{ row.score }}</td>
              <td class="mono" style="font-size: 12px; color: var(--jk-muted)">
                {{ new Date(row.createdAt).toLocaleString() }}
              </td>
            </tr>
          </tbody>
        </table>
        </div>

        <div v-if="!items.length" class="jk-empty">
          <div class="jk-empty-icon">∅</div>
          <div>// 没有符合条件的提交记录</div>
        </div>

        <div v-if="totalPages > 1" class="pager">
          <n-pagination v-model:page="page" :page-count="totalPages" @update:page="load" />
        </div>
      </section>
    </div>
  </n-spin>
</template>
