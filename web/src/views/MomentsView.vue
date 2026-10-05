<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NAvatar, NButton, NInput, NSpin, NTag, useMessage, useDialog } from 'naive-ui';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const message = useMessage();
const dialog = useDialog();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const items = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const totalPages = ref(1);
const posting = ref(false);
const form = ref({ content: '', images: [] as string[] });
const uploading = ref(false);
const openComments = ref<Set<number>>(new Set());
const comments = ref<Record<number, any[]>>({});
const commentDraft = ref<Record<number, string>>({});

const mine = computed(() => route.query.mine === '1');
const scopeUser = computed(() => String(route.query.username ?? ''));

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: String(page.value), size: '20' });
    if (mine.value) params.set('mine', 'true');
    if (scopeUser.value) params.set('username', scopeUser.value);
    const data = await api.get<any>(`/api/moments?${params.toString()}`);
    items.value = data.items ?? [];
    total.value = data.total ?? 0;
    totalPages.value = data.totalPages ?? 1;
  } finally {
    loading.value = false;
  }
}

async function uploadImages(files: FileList | null) {
  if (!files?.length) return;
  uploading.value = true;
  try {
    for (const file of Array.from(files).slice(0, 9 - form.value.images.length)) {
      const data = await api.upload<{ url: string }>('/api/upload/image', file);
      form.value.images.push(data.url);
    }
  } catch (err: any) {
    message.error(err?.message ?? '图片上传失败');
  } finally {
    uploading.value = false;
  }
}

async function publish() {
  if (!form.value.content.trim() && !form.value.images.length) {
    message.warning('写点什么或者配张图吧');
    return;
  }
  posting.value = true;
  try {
    const result = await api.post<any>('/api/moments', { content: form.value.content.trim(), images: form.value.images });
    message.success(result?.pending ? '已提交，等待管理员审核' : '发布成功');
    form.value = { content: '', images: [] };
    page.value = 1;
    await load();
  } catch (err: any) {
    message.error(err?.message ?? '发布失败');
  } finally {
    posting.value = false;
  }
}

async function like(item: any) {
  if (!auth.isLogin) {
    router.push('/login');
    return;
  }
  const data = await api.post<any>(`/api/moments/${item.id}/like`);
  item.liked = data.liked;
  item.likeCount = data.likeCount;
}

async function toggleComments(item: any) {
  const next = new Set(openComments.value);
  if (next.has(Number(item.id))) {
    next.delete(Number(item.id));
    openComments.value = next;
    return;
  }
  next.add(Number(item.id));
  openComments.value = next;
  if (!comments.value[item.id]) {
    const data = await api.get<any>(`/api/moments/${item.id}/comments`);
    comments.value = { ...comments.value, [item.id]: data.items ?? [] };
  }
}

async function sendComment(item: any) {
  const content = (commentDraft.value[item.id] ?? '').trim();
  if (!content) return;
  if (!auth.isLogin) {
    router.push('/login');
    return;
  }
  try {
    await api.post(`/api/moments/${item.id}/comments`, { content });
    commentDraft.value = { ...commentDraft.value, [item.id]: '' };
    const data = await api.get<any>(`/api/moments/${item.id}/comments`);
    comments.value = { ...comments.value, [item.id]: data.items ?? [] };
    item.commentCount = (item.commentCount ?? 0) + 1;
  } catch (err: any) {
    message.error(err?.message ?? '评论失败');
  }
}

function remove(item: any) {
  dialog.warning({
    title: '删除动态',
    content: '确定要删除这条动态吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await api.del(`/api/moments/${item.id}`);
      message.success('已删除');
      await load();
    },
  });
}

onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <div class="jk-page">
      <header class="jk-head">
        <span class="jk-head-icon">◎</span>
        <div style="min-width: 0">
          <h1>{{ mine ? '我的动态' : scopeUser ? `@${scopeUser} 的动态` : '动态' }}</h1>
          <p><span>共 {{ total }} 条</span><span> · 发布动态也能拿积分</span></p>
        </div>
        <div class="jk-head-actions">
          <div class="seg">
            <button :class="!mine ? 'on' : ''" @click="router.push('/moments')">全站</button>
            <button :class="mine ? 'on' : ''" @click="router.push('/moments?mine=1')">我的</button>
          </div>
        </div>
      </header>

      <section v-if="auth.isLogin && !scopeUser" class="jk-panel">
        <div class="jk-section"><h2>发条动态</h2></div>
        <n-input
          v-model:value="form.content"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 8 }"
          maxlength="2000"
          show-count
          placeholder="今天刷到什么题了？分享一下思路或者踩的坑"
        />
        <div v-if="form.images.length" class="moment-images">
          <div v-for="(img, i) in form.images" :key="img" class="moment-image">
            <img :src="img" alt="" />
            <button class="moment-image-remove" @click="form.images.splice(i, 1)">×</button>
          </div>
        </div>
        <div class="moment-actions">
          <label class="jk-mini-btn" :class="uploading ? 'is-disabled' : ''">
            {{ uploading ? '上传中…' : '添加图片' }}
            <input type="file" accept="image/*" multiple class="hidden" @change="(e) => uploadImages((e.target as HTMLInputElement).files)" />
          </label>
          <n-button size="small" type="primary" :loading="posting" @click="publish">发布</n-button>
        </div>
      </section>

      <p v-else-if="!auth.isLogin" class="jk-empty">
        <RouterLink to="/login" style="color: var(--jk-accent)">登录</RouterLink> 后可以发动态、点赞和评论
      </p>

      <div v-if="!items.length && !loading" class="jk-empty">
        <div class="jk-empty-icon">□</div>
        <div>// 还没有人发动态</div>
      </div>

      <article v-for="item in items" :key="item.id" class="jk-panel moment-item">
        <div class="moment-head">
          <RouterLink :to="`/users/${item.user.username}`">
            <n-avatar round :size="36" :src="item.user.avatar || undefined">{{ item.user.displayName.slice(0, 1) }}</n-avatar>
          </RouterLink>
          <div style="min-width: 0; flex: 1">
            <div class="moment-name">
              <RouterLink :to="`/users/${item.user.username}`">{{ item.user.displayName }}</RouterLink>
              <n-tag v-if="item.pinned" size="tiny" type="warning" :bordered="false">置顶</n-tag>
            </div>
            <div class="moment-time mono">{{ new Date(item.createdAt).toLocaleString() }}</div>
          </div>
          <n-button v-if="item.isMine || auth.isAdmin" size="tiny" text type="error" @click="remove(item)">删除</n-button>
        </div>

        <p v-if="item.content" class="moment-content">{{ item.content }}</p>
        <div v-if="item.images?.length" class="moment-images">
          <a v-for="img in item.images" :key="img" :href="img" target="_blank" rel="noreferrer" class="moment-image">
            <img :src="img" alt="" />
          </a>
        </div>

        <div class="moment-foot">
          <button class="moment-action" :class="item.liked ? 'is-on' : ''" @click="like(item)">
            {{ item.liked ? '♥' : '♡' }} {{ item.likeCount }}
          </button>
          <button class="moment-action" @click="toggleComments(item)">
            💬 {{ item.commentCount }}
          </button>
        </div>

        <div v-if="openComments.has(Number(item.id))" class="moment-comments">
          <div v-for="c in comments[item.id] ?? []" :key="c.id" class="moment-comment">
            <RouterLink :to="`/users/${c.user.username}`" class="moment-comment-name">{{ c.user.displayName }}</RouterLink>
            <span>{{ c.content }}</span>
          </div>
          <div class="moment-comment-form">
            <n-input
              :value="commentDraft[item.id] ?? ''"
              size="small"
              placeholder="说点什么…"
              @update:value="(v: string) => (commentDraft[item.id] = v)"
              @keyup.enter="sendComment(item)"
            />
            <n-button size="small" @click="sendComment(item)">发送</n-button>
          </div>
        </div>
      </article>

      <div v-if="totalPages > 1" class="pager">
        <n-button size="small" :disabled="page <= 1" @click="page -= 1; load()">上一页</n-button>
        <span class="mono" style="font-size: 12px; color: var(--jk-muted)">{{ page }} / {{ totalPages }}</span>
        <n-button size="small" :disabled="page >= totalPages" @click="page += 1; load()">下一页</n-button>
      </div>
    </div>
  </n-spin>
</template>

<style scoped>
.moment-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.moment-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.moment-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.moment-name a {
  color: inherit;
  text-decoration: none;
}

.moment-time {
  font-size: 11px;
  color: var(--jk-muted);
}

.moment-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.moment-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.moment-image {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--jk-border);
  border-radius: 6px;
  background: var(--jk-bg-soft);
}

.moment-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.moment-image-remove {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
}

.moment-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.moment-foot {
  display: flex;
  gap: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--jk-border);
}

.moment-action {
  border: none;
  background: transparent;
  color: var(--jk-text-2);
  font-size: 13px;
  cursor: pointer;
}

.moment-action:hover,
.moment-action.is-on {
  color: var(--jk-danger);
}

.moment-comments {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 6px;
  background: var(--jk-bg-soft);
}

.moment-comment {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.moment-comment-name {
  flex: none;
  color: var(--jk-accent);
  text-decoration: none;
}

.moment-comment-form {
  display: flex;
  gap: 8px;
}

.jk-mini-btn.is-disabled {
  opacity: 0.6;
  pointer-events: none;
}
</style>
