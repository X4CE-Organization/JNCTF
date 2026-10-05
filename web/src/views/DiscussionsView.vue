<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { NButton, NInput, NModal, NSelect, NSpin, NTag, useMessage } from 'naive-ui';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const message = useMessage();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const items = ref<any[]>([]);
const boards = ref<Array<{ slug: string; name: string; count: number }>>([]);
const total = ref(0);
const page = ref(1);
const totalPages = ref(1);
const board = ref('all');
const keyword = ref('');
const createOpen = ref(false);
const posting = ref(false);
const form = ref({ title: '', content: '', board: '综合讨论' });

const boardOptions = ref<Array<{ label: string; value: string }>>([]);

async function loadBoards() {
  const data = await api.get<any>('/api/discussions/boards').catch(() => ({ items: [] }));
  boards.value = data.items ?? [];
  boardOptions.value = boards.value.filter((b) => b.slug !== 'all').map((b) => ({ label: b.name, value: b.name }));
  if (boardOptions.value.length) form.value.board = boardOptions.value[0]!.value;
}

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: String(page.value), size: '20', board: board.value });
    if (keyword.value.trim()) params.set('keyword', keyword.value.trim());
    const data = await api.get<any>(`/api/discussions?${params.toString()}`);
    items.value = data.items ?? [];
    total.value = data.total ?? 0;
    totalPages.value = data.totalPages ?? 1;
  } finally {
    loading.value = false;
  }
}

async function create() {
  if (form.value.title.trim().length < 2) {
    message.warning('标题太短了');
    return;
  }
  if (!form.value.content.trim()) {
    message.warning('内容不能为空');
    return;
  }
  posting.value = true;
  try {
    const result = await api.post<any>('/api/discussions', form.value);
    message.success('发布成功');
    createOpen.value = false;
    form.value = { title: '', content: '', board: form.value.board };
    router.push(`/discussions/${result.id}`);
  } catch (err: any) {
    message.error(err?.message ?? '发布失败');
  } finally {
    posting.value = false;
  }
}

watch(board, () => {
  page.value = 1;
  load();
});

onMounted(async () => {
  if (route.query.board) board.value = String(route.query.board);
  await loadBoards();
  await load();
});
</script>

<template>
  <n-spin :show="loading">
    <div class="jk-page">
      <header class="jk-head">
        <button class="back-btn" title="返回上一页" @click="router.back()">←</button>
        <span class="jk-head-icon">💬</span>
        <div style="min-width: 0">
          <h1>讨论区</h1>
          <p><span>共 {{ total }} 个主题</span><span> · 求助、交流、反馈都在这儿</span></p>
        </div>
        <div class="jk-head-actions">
          <n-button size="small" type="primary" :disabled="!auth.isLogin" @click="createOpen = true">发新帖</n-button>
        </div>
      </header>

      <section class="jk-panel">
        <div class="filter-bar">
          <div class="seg board-seg">
            <button v-for="b in boards" :key="b.slug" :class="board === b.slug ? 'on' : ''" @click="board = b.slug">
              {{ b.name }}<span class="board-count">{{ b.count }}</span>
            </button>
          </div>
          <n-input v-model:value="keyword" placeholder="搜索标题" clearable style="width: 200px; margin-left: auto" @keyup.enter="page = 1; load()">
            <template #suffix><button class="jk-mini-btn" @click="page = 1; load()">搜索</button></template>
          </n-input>
        </div>

        <div class="table-scroll">
        <table class="jk-table">
          <thead>
            <tr>
              <th>主题</th>
              <th style="width: 140px">作者</th>
              <th style="width: 90px">回复</th>
              <th style="width: 90px">浏览</th>
              <th style="width: 170px">最后回复</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in items" :key="d.id">
              <td>
                <div class="disc-title">
                  <n-tag v-if="d.pinned" size="tiny" type="warning" :bordered="false">置顶</n-tag>
                  <n-tag v-if="d.locked" size="tiny" :bordered="false">已锁定</n-tag>
                  <n-tag size="tiny" :bordered="false">{{ d.board }}</n-tag>
                  <RouterLink :to="`/discussions/${d.id}`" class="table-link">{{ d.title }}</RouterLink>
                </div>
              </td>
              <td><RouterLink :to="`/users/${d.user.username}`" class="table-link">@{{ d.user.username }}</RouterLink></td>
              <td class="mono">{{ d.replyCount }}</td>
              <td class="mono">{{ d.views }}</td>
              <td class="mono" style="font-size: 12px; color: var(--jk-muted)">{{ new Date(d.lastReplyAt).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
        </div>

        <div v-if="!items.length" class="jk-empty">
          <div class="jk-empty-icon">□</div>
          <div>// 这个板块还没有帖子</div>
        </div>

        <div v-if="totalPages > 1" class="pager">
          <n-button size="small" :disabled="page <= 1" @click="page -= 1; load()">上一页</n-button>
          <span class="mono" style="font-size: 12px; color: var(--jk-muted)">{{ page }} / {{ totalPages }}</span>
          <n-button size="small" :disabled="page >= totalPages" @click="page += 1; load()">下一页</n-button>
        </div>
      </section>

      <n-modal v-model:show="createOpen" preset="card" title="发新帖" style="max-width: 640px">
        <div class="create-form">
          <n-select v-model:value="form.board" :options="boardOptions" placeholder="选择板块" />
          <n-input v-model:value="form.title" placeholder="标题" maxlength="200" />
          <n-input
            v-model:value="form.content"
            type="textarea"
            :autosize="{ minRows: 8, maxRows: 20 }"
            placeholder="支持 Markdown，把问题描述清楚更容易得到回复"
          />
        </div>
        <template #footer>
          <div style="display: flex; justify-content: flex-end; gap: 8px">
            <n-button @click="createOpen = false">取消</n-button>
            <n-button type="primary" :loading="posting" @click="create">发布</n-button>
          </div>
        </template>
      </n-modal>
    </div>
  </n-spin>
</template>

<style scoped>
.board-seg {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px;
  border-radius: 6px;
  background: var(--jk-bg-soft);
}

.board-seg button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--jk-text-2);
  font-size: 13px;
  cursor: pointer;
}

.board-seg button.on {
  background: var(--jk-bg-elev);
  color: var(--jk-accent);
  font-weight: 600;
  box-shadow: var(--jk-shadow-sm);
}

.board-count {
  margin-left: 5px;
  font-family: var(--jk-mono);
  font-size: 11px;
  opacity: 0.6;
}

.disc-title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
