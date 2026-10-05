<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { NAvatar, NButton, NInput, NSpin, NTag, useMessage } from 'naive-ui';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import MarkdownView from '../components/MarkdownView.vue';

const auth = useAuthStore();
const message = useMessage();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const article = ref<any>(null);
const comment = ref('');
const posting = ref(false);

async function load() {
  loading.value = true;
  try {
    article.value = await api.get<any>(`/api/articles/${route.params.id}`);
  } catch (err: any) {
    message.error(err?.message ?? '文章不存在');
    router.push('/articles');
  } finally {
    loading.value = false;
  }
}

async function like() {
  if (!auth.isLogin) {
    router.push('/login');
    return;
  }
  const data = await api.post<any>(`/api/articles/${article.value.id}/like`);
  article.value.likeCount = data.likeCount;
}

async function send() {
  if (!comment.value.trim()) return;
  if (!auth.isLogin) {
    router.push('/login');
    return;
  }
  posting.value = true;
  try {
    await api.post(`/api/articles/${article.value.id}/comments`, { content: comment.value.trim() });
    comment.value = '';
    await load();
  } catch (err: any) {
    message.error(err?.message ?? '评论失败');
  } finally {
    posting.value = false;
  }
}

watch(() => route.params.id, load);
onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <div v-if="article" class="jk-page article-page">
      <header class="jk-head">
        <button class="back-btn" title="返回文章广场" @click="router.push('/articles')">←</button>
        <span class="jk-head-icon">✎</span>
        <div style="min-width: 0">
          <h1>{{ article.title }}</h1>
          <p>
            <n-tag size="tiny" :bordered="false">{{ article.category }}</n-tag>
            <n-tag v-if="article.state !== 'APPROVED'" size="tiny" type="warning" :bordered="false" style="margin-left: 6px">待审核</n-tag>
            <span style="margin-left: 8px">
              <RouterLink :to="`/users/${article.user.username}`" style="color: var(--jk-accent); text-decoration: none">
                @{{ article.user.username }}
              </RouterLink>
              · {{ new Date(article.createdAt).toLocaleString() }} · 👁 {{ article.views }}
            </span>
          </p>
        </div>
        <div class="jk-head-actions">
          <n-button size="small" @click="like">♥ {{ article.likeCount }}</n-button>
        </div>
      </header>

      <img v-if="article.cover" :src="article.cover" alt="" class="article-banner" />

      <section class="jk-panel">
        <MarkdownView :content="article.content" />
      </section>

      <section class="jk-panel">
        <div class="jk-section"><h2>评论</h2><span class="count">{{ article.comments.length }}</span></div>
        <div v-if="!article.comments.length" style="font-size: 13px; color: var(--jk-muted)">还没有评论</div>
        <div v-for="c in article.comments" :key="c.id" class="comment-item">
          <RouterLink :to="`/users/${c.user.username}`">
            <n-avatar round :size="30" :src="c.user.avatar || undefined">{{ c.user.displayName.slice(0, 1) }}</n-avatar>
          </RouterLink>
          <div style="min-width: 0; flex: 1">
            <div class="comment-head">
              <RouterLink :to="`/users/${c.user.username}`" class="comment-name">{{ c.user.displayName }}</RouterLink>
              <span class="mono comment-time">{{ new Date(c.createdAt).toLocaleString() }}</span>
            </div>
            <p class="comment-text">{{ c.content }}</p>
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 14px">
          <n-input v-model:value="comment" placeholder="说点什么…" @keyup.enter="send" />
          <n-button size="small" type="primary" :loading="posting" @click="send">发送</n-button>
        </div>
      </section>
    </div>
  </n-spin>
</template>

<style scoped>
.article-page {
  max-width: 900px;
  margin: 0 auto;
}

.article-banner {
  width: 100%;
  max-height: 300px;
  object-fit: cover;
  border: 1px solid var(--jk-border);
  border-radius: 8px;
}

.comment-item {
  display: flex;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px dashed var(--jk-border);
}

.comment-item:last-of-type {
  border-bottom: 0;
}

.comment-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.comment-name {
  font-size: 13px;
  font-weight: 600;
  color: inherit;
  text-decoration: none;
}

.comment-time {
  font-size: 11px;
  color: var(--jk-muted);
}

.comment-text {
  margin: 4px 0 0;
  font-size: 13.5px;
  line-height: 1.65;
  white-space: pre-wrap;
}
</style>
