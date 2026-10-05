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
const categories = ref<Array<{ slug: string; name: string; count: number }>>([]);
const total = ref(0);
const page = ref(1);
const totalPages = ref(1);
const category = ref('all');
const keyword = ref('');
const mine = ref(false);
const createOpen = ref(false);
const posting = ref(false);
const uploading = ref(false);
const form = ref({ title: '', content: '', summary: '', category: '综合', cover: '' });
const categoryOptions = ref<Array<{ label: string; value: string }>>([]);

async function loadCategories() {
  const data = await api.get<any>('/api/articles/categories').catch(() => ({ items: [] }));
  categories.value = data.items ?? [];
  categoryOptions.value = categories.value.filter((c) => c.slug !== 'all').map((c) => ({ label: c.name, value: c.name }));
  if (categoryOptions.value.length) form.value.category = categoryOptions.value[0]!.value;
}

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: String(page.value), size: '12', category: category.value });
    if (keyword.value.trim()) params.set('keyword', keyword.value.trim());
    if (mine.value) params.set('mine', 'true');
    const data = await api.get<any>(`/api/articles?${params.toString()}`);
    items.value = data.items ?? [];
    total.value = data.total ?? 0;
    totalPages.value = data.totalPages ?? 1;
  } finally {
    loading.value = false;
  }
}

async function uploadCover(files: FileList | null) {
  const file = files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const data = await api.upload<{ url: string }>('/api/upload/image', file);
    form.value.cover = data.url;
  } catch (err: any) {
    message.error(err?.message ?? '封面上传失败');
  } finally {
    uploading.value = false;
  }
}

async function create() {
  if (form.value.title.trim().length < 2) {
    message.warning('标题太短了');
    return;
  }
  if (!form.value.content.trim()) {
    message.warning('正文不能为空');
    return;
  }
  posting.value = true;
  try {
    const result = await api.post<any>('/api/articles', form.value);
    message.success(result?.pending ? '已提交，等待管理员审核' : '发布成功');
    createOpen.value = false;
    form.value = { title: '', content: '', summary: '', category: form.value.category, cover: '' };
    await load();
  } catch (err: any) {
    message.error(err?.message ?? '发布失败');
  } finally {
    posting.value = false;
  }
}

watch(category, () => {
  page.value = 1;
  load();
});

watch(mine, () => {
  page.value = 1;
  load();
});

onMounted(async () => {
  await loadCategories();
  await load();
});
</script>

<template>
  <n-spin :show="loading">
    <div class="jk-page">
      <header class="jk-head">
        <button class="back-btn" title="返回上一页" @click="router.back()">←</button>
        <span class="jk-head-icon">✎</span>
        <div style="min-width: 0">
          <h1>文章广场</h1>
          <p><span>共 {{ total }} 篇</span><span> · CTF 入门、逆向、Web、密码学都欢迎</span></p>
        </div>
        <div class="jk-head-actions">
          <div class="seg">
            <button :class="!mine ? 'on' : ''" @click="mine = false">全部</button>
            <button :class="mine ? 'on' : ''" @click="mine = true">我的</button>
          </div>
          <n-button size="small" type="primary" :disabled="!auth.isLogin" @click="createOpen = true">写文章</n-button>
        </div>
      </header>

      <section class="jk-panel">
        <div class="filter-bar">
          <div class="seg board-seg">
            <button v-for="c in categories" :key="c.slug" :class="category === c.slug ? 'on' : ''" @click="category = c.slug">
              {{ c.name }}<span class="board-count">{{ c.count }}</span>
            </button>
          </div>
          <n-input v-model:value="keyword" placeholder="搜索标题或摘要" clearable style="width: 220px; margin-left: auto" @keyup.enter="page = 1; load()">
            <template #suffix><button class="jk-mini-btn" @click="page = 1; load()">搜索</button></template>
          </n-input>
        </div>

        <div v-if="items.length" class="article-grid">
          <RouterLink v-for="a in items" :key="a.id" :to="`/articles/${a.id}`" class="article-card">
            <div class="article-cover" :style="a.cover ? { backgroundImage: `url(${a.cover})` } : {}">
              <span v-if="!a.cover" class="mono">{{ a.title.slice(0, 2) }}</span>
            </div>
            <div class="article-body">
              <div class="article-tags">
                <n-tag size="tiny" :bordered="false">{{ a.category }}</n-tag>
                <n-tag v-if="a.state !== 'APPROVED'" size="tiny" type="warning" :bordered="false">待审核</n-tag>
                <n-tag v-if="a.pinned" size="tiny" type="error" :bordered="false">置顶</n-tag>
              </div>
              <h3>{{ a.title }}</h3>
              <p>{{ a.summary || '（没有摘要）' }}</p>
              <div class="article-meta mono">
                @{{ a.user.username }} · {{ new Date(a.createdAt).toLocaleDateString() }} · 👁 {{ a.views }}
              </div>
            </div>
          </RouterLink>
        </div>

        <div v-else class="jk-empty">
          <div class="jk-empty-icon">□</div>
          <div>// 还没有文章，来写第一篇</div>
        </div>

        <div v-if="totalPages > 1" class="pager">
          <n-button size="small" :disabled="page <= 1" @click="page -= 1; load()">上一页</n-button>
          <span class="mono" style="font-size: 12px; color: var(--jk-muted)">{{ page }} / {{ totalPages }}</span>
          <n-button size="small" :disabled="page >= totalPages" @click="page += 1; load()">下一页</n-button>
        </div>
      </section>

      <n-modal v-model:show="createOpen" preset="card" title="写文章" style="max-width: 760px">
        <div class="create-form">
          <n-input v-model:value="form.title" placeholder="标题" maxlength="200" />
          <div style="display: flex; gap: 10px">
            <n-select v-model:value="form.category" :options="categoryOptions" style="width: 180px" />
            <n-input v-model:value="form.summary" placeholder="摘要（可选，留空自动截取）" maxlength="500" />
          </div>
          <div style="display: flex; align-items: center; gap: 10px">
            <label class="jk-mini-btn">
              {{ uploading ? '上传中…' : form.cover ? '更换封面' : '上传封面（可选）' }}
              <input type="file" accept="image/*" class="hidden" @change="(e) => uploadCover((e.target as HTMLInputElement).files)" />
            </label>
            <img v-if="form.cover" :src="form.cover" alt="" class="cover-preview" />
          </div>
          <n-input
            v-model:value="form.content"
            type="textarea"
            :autosize="{ minRows: 12, maxRows: 30 }"
            placeholder="正文，支持 Markdown"
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
.article-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.article-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--jk-border);
  border-radius: 8px;
  background: var(--jk-bg-soft);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.14s ease, transform 0.14s ease;
}

.article-card:hover {
  border-color: var(--jk-accent);
  transform: translateY(-2px);
}

.article-cover {
  display: grid;
  place-items: center;
  height: 116px;
  background-color: var(--jk-bg-elev);
  background-size: cover;
  background-position: center;
  border-bottom: 1px solid var(--jk-border);
  font-size: 22px;
  color: var(--jk-accent);
  letter-spacing: 0.08em;
}

.article-body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px 14px 14px;
}

.article-tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.article-body h3 {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.45;
}

.article-body p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--jk-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-meta {
  font-size: 11px;
  color: var(--jk-muted);
}

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

.create-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cover-preview {
  height: 38px;
  border: 1px solid var(--jk-border);
  border-radius: 5px;
}
</style>
