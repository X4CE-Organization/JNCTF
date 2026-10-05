<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NButton, NTag, useMessage, useDialog } from 'naive-ui';
import { RouterLink } from 'vue-router';
import { api } from '../../api';

const message = useMessage();
const dialog = useDialog();
const tab = ref<'moments' | 'discussions' | 'articles'>('moments');
const loading = ref(false);
const moments = ref<any[]>([]);
const discussions = ref<any[]>([]);
const articles = ref<any[]>([]);
const articleState = ref<string | null>(null);

async function loadMoments() {
  moments.value = (await api.get<any>('/api/admin/moments?size=50')).items ?? [];
}

async function loadDiscussions() {
  discussions.value = (await api.get<any>('/api/admin/discussions?size=50')).items ?? [];
}

async function loadArticles() {
  const q = articleState.value ? `&state=${articleState.value}` : '';
  articles.value = (await api.get<any>(`/api/admin/articles?size=50${q}`)).items ?? [];
}

async function load() {
  loading.value = true;
  try {
    if (tab.value === 'moments') await loadMoments();
    else if (tab.value === 'discussions') await loadDiscussions();
    else await loadArticles();
  } finally {
    loading.value = false;
  }
}

function confirmRemove(kind: string, id: number, label: string, reload: () => Promise<void>) {
  dialog.warning({
    title: '确认删除',
    content: `删除后无法恢复，确定删除「${label.slice(0, 30)}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await api.del(`/api/admin/${kind}/${id}`);
      message.success('已删除');
      await reload();
    },
  });
}

async function toggleMoment(row: any, field: 'hidden' | 'pinned') {
  await api.put(`/api/admin/moments/${row.id}`, { [field]: !row[field] });
  await loadMoments();
}

async function toggleDiscussion(row: any, field: 'hidden' | 'pinned' | 'locked') {
  await api.put(`/api/admin/discussions/${row.id}`, { [field]: !row[field] });
  await loadDiscussions();
}

async function setArticle(row: any, state: 'PENDING' | 'APPROVED') {
  await api.put(`/api/admin/articles/${row.id}`, { state });
  message.success(state === 'APPROVED' ? '已通过' : '已打回');
  await loadArticles();
}

async function toggleArticle(row: any, field: 'hidden' | 'pinned') {
  await api.put(`/api/admin/articles/${row.id}`, { [field]: !row[field] });
  await loadArticles();
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="seg" style="display: inline-flex; padding: 3px; border-radius: 6px; background: var(--jk-bg-soft)">
      <button class="admin-tab" :class="tab === 'moments' ? 'is-active' : ''" @click="tab = 'moments'; load()">动态</button>
      <button class="admin-tab" :class="tab === 'discussions' ? 'is-active' : ''" @click="tab = 'discussions'; load()">讨论</button>
      <button class="admin-tab" :class="tab === 'articles' ? 'is-active' : ''" @click="tab = 'articles'; load()">文章</button>
    </div>

    <!-- 动态 -->
    <div v-if="tab === 'moments'" class="jk-panel">
      <div class="jk-section"><h2>动态管理</h2><span class="count">{{ moments.length }}</span></div>
      <div v-for="row in moments" :key="row.id" class="jk-list-item">
        <RouterLink :to="`/users/${row.user.username}`" class="table-link" style="width: 130px; flex: none">@{{ row.user.username }}</RouterLink>
        <span style="flex: 1; min-width: 0; font-size: 13px">{{ row.content.slice(0, 70) }}</span>
        <span class="mono" style="font-size: 11px; color: var(--jk-muted)">♥{{ row.likeCount }} 💬{{ row.commentCount }}</span>
        <n-tag v-if="row.hidden" size="tiny" type="warning" :bordered="false">已隐藏</n-tag>
        <n-button size="tiny" text @click="toggleMoment(row, 'pinned')">{{ row.pinned ? '取消置顶' : '置顶' }}</n-button>
        <n-button size="tiny" text @click="toggleMoment(row, 'hidden')">{{ row.hidden ? '恢复' : '隐藏' }}</n-button>
        <n-button size="tiny" text type="error" @click="confirmRemove('moments', row.id, row.content, loadMoments)">删除</n-button>
      </div>
      <p v-if="!moments.length" style="font-size: 13px; color: var(--jk-muted)">暂无动态</p>
    </div>

    <!-- 讨论 -->
    <div v-else-if="tab === 'discussions'" class="jk-panel">
      <div class="jk-section"><h2>讨论管理</h2><span class="count">{{ discussions.length }}</span></div>
      <table class="jk-table">
        <thead>
          <tr>
            <th style="width: 60px">ID</th>
            <th>标题</th>
            <th style="width: 100px">板块</th>
            <th style="width: 130px">作者</th>
            <th style="width: 80px">回复</th>
            <th style="width: 260px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in discussions" :key="row.id">
            <td class="mono">{{ row.id }}</td>
            <td>
              <RouterLink :to="`/discussions/${row.id}`" class="table-link">{{ row.title }}</RouterLink>
              <n-tag v-if="row.hidden" size="tiny" type="warning" :bordered="false" style="margin-left: 6px">已隐藏</n-tag>
            </td>
            <td><n-tag size="tiny" :bordered="false">{{ row.board }}</n-tag></td>
            <td><RouterLink :to="`/users/${row.user.username}`" class="table-link">@{{ row.user.username }}</RouterLink></td>
            <td class="mono">{{ row.replyCount }}</td>
            <td>
              <n-button size="tiny" text @click="toggleDiscussion(row, 'pinned')">{{ row.pinned ? '取消置顶' : '置顶' }}</n-button>
              <n-button size="tiny" text @click="toggleDiscussion(row, 'locked')">{{ row.locked ? '解锁' : '锁定' }}</n-button>
              <n-button size="tiny" text @click="toggleDiscussion(row, 'hidden')">{{ row.hidden ? '恢复' : '隐藏' }}</n-button>
              <n-button size="tiny" text type="error" @click="confirmRemove('discussions', row.id, row.title, loadDiscussions)">删除</n-button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!discussions.length" style="font-size: 13px; color: var(--jk-muted)">暂无帖子</p>
    </div>

    <!-- 文章 -->
    <div v-else class="jk-panel">
      <div class="jk-section">
        <h2>文章管理</h2>
        <span class="count">{{ articles.length }}</span>
        <div class="seg" style="margin-left: auto; display: flex; gap: 4px">
          <button class="admin-tab" :class="!articleState ? 'is-active' : ''" @click="articleState = null; loadArticles()">全部</button>
          <button class="admin-tab" :class="articleState === 'PENDING' ? 'is-active' : ''" @click="articleState = 'PENDING'; loadArticles()">待审核</button>
          <button class="admin-tab" :class="articleState === 'APPROVED' ? 'is-active' : ''" @click="articleState = 'APPROVED'; loadArticles()">已通过</button>
        </div>
      </div>
      <table class="jk-table">
        <thead>
          <tr>
            <th style="width: 60px">ID</th>
            <th>标题</th>
            <th style="width: 110px">分类</th>
            <th style="width: 130px">作者</th>
            <th style="width: 90px">状态</th>
            <th style="width: 260px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in articles" :key="row.id">
            <td class="mono">{{ row.id }}</td>
            <td>
              <RouterLink :to="`/articles/${row.id}`" class="table-link">{{ row.title }}</RouterLink>
              <n-tag v-if="row.pinned" size="tiny" type="error" :bordered="false" style="margin-left: 6px">置顶</n-tag>
            </td>
            <td><n-tag size="tiny" :bordered="false">{{ row.category }}</n-tag></td>
            <td><RouterLink :to="`/users/${row.user.username}`" class="table-link">@{{ row.user.username }}</RouterLink></td>
            <td>
              <n-tag size="tiny" :type="row.state === 'APPROVED' ? 'success' : 'warning'" :bordered="false">
                {{ row.state === 'APPROVED' ? '已通过' : '待审核' }}
              </n-tag>
            </td>
            <td>
              <n-button v-if="row.state !== 'APPROVED'" size="tiny" text type="primary" @click="setArticle(row, 'APPROVED')">通过</n-button>
              <n-button v-else size="tiny" text @click="setArticle(row, 'PENDING')">打回</n-button>
              <n-button size="tiny" text @click="toggleArticle(row, 'pinned')">{{ row.pinned ? '取消置顶' : '置顶' }}</n-button>
              <n-button size="tiny" text @click="toggleArticle(row, 'hidden')">{{ row.hidden ? '恢复' : '隐藏' }}</n-button>
              <n-button size="tiny" text type="error" @click="confirmRemove('articles', row.id, row.title, loadArticles)">删除</n-button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!articles.length" style="font-size: 13px; color: var(--jk-muted)">暂无文章</p>
    </div>
  </div>
</template>
