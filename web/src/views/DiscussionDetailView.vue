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
const topic = ref<any>(null);
const reply = ref('');
const posting = ref(false);

async function load() {
  loading.value = true;
  try {
    topic.value = await api.get<any>(`/api/discussions/${route.params.id}`);
  } catch (err: any) {
    message.error(err?.message ?? '帖子不存在');
    router.push('/discussions');
  } finally {
    loading.value = false;
  }
}

async function send() {
  if (!reply.value.trim()) return;
  posting.value = true;
  try {
    await api.post(`/api/discussions/${route.params.id}/replies`, { content: reply.value.trim() });
    reply.value = '';
    await load();
  } catch (err: any) {
    message.error(err?.message ?? '回复失败');
  } finally {
    posting.value = false;
  }
}

watch(() => route.params.id, load);
onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <div v-if="topic" class="jk-page">
      <header class="jk-head">
        <button class="back-btn" title="返回讨论区" @click="router.push('/discussions')">←</button>
        <span class="jk-head-icon">💬</span>
        <div style="min-width: 0">
          <h1>{{ topic.title }}</h1>
          <p>
            <n-tag size="tiny" :bordered="false">{{ topic.board }}</n-tag>
            <RouterLink :to="`/users/${topic.user.username}`" style="margin-left: 8px; color: var(--jk-accent); text-decoration: none">
              @{{ topic.user.username }}
            </RouterLink>
            <span> · {{ new Date(topic.createdAt).toLocaleString() }} · {{ topic.views }} 次浏览</span>
          </p>
        </div>
      </header>

      <section class="jk-panel">
        <MarkdownView v-if="topic.content" :content="topic.content" />
      </section>

      <section class="jk-panel">
        <div class="jk-section"><h2>回复</h2><span class="count">{{ topic.replies.length }}</span></div>
        <div v-if="!topic.replies.length" class="jk-empty" style="padding: 20px; border: none">
          <div class="mono" style="font-size: 12px">// 还没有人回复</div>
        </div>
        <div v-for="r in topic.replies" :key="r.id" class="reply-item">
          <RouterLink :to="`/users/${r.user.username}`">
            <n-avatar round :size="32" :src="r.user.avatar || undefined">{{ r.user.displayName.slice(0, 1) }}</n-avatar>
          </RouterLink>
          <div style="min-width: 0; flex: 1">
            <div class="reply-head">
              <RouterLink :to="`/users/${r.user.username}`" class="reply-name">{{ r.user.displayName }}</RouterLink>
              <span class="mono reply-meta">#{{ r.floor }} · {{ new Date(r.createdAt).toLocaleString() }}</span>
            </div>
            <MarkdownView :content="r.content" />
          </div>
        </div>
      </section>

      <section class="jk-panel">
        <div class="jk-section"><h2>发表回复</h2></div>
        <template v-if="auth.isLogin && !topic.locked">
          <n-input
            v-model:value="reply"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 14 }"
            placeholder="支持 Markdown"
          />
          <div style="display: flex; justify-content: flex-end; margin-top: 10px">
            <n-button size="small" type="primary" :loading="posting" @click="send">回复</n-button>
          </div>
        </template>
        <p v-else-if="topic.locked" style="margin: 0; font-size: 13px; color: var(--jk-muted)">该帖已锁定，无法回复</p>
        <p v-else style="margin: 0; font-size: 13px; color: var(--jk-muted)">
          <RouterLink to="/login" style="color: var(--jk-accent)">登录</RouterLink> 后可以回复
        </p>
      </section>
    </div>
  </n-spin>
</template>

<style scoped>
.reply-item {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--jk-border);
}

.reply-item:last-child {
  border-bottom: 0;
}

.reply-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 4px;
}

.reply-name {
  font-size: 13.5px;
  font-weight: 600;
  color: inherit;
  text-decoration: none;
}

.reply-meta {
  font-size: 11px;
  color: var(--jk-muted);
}
</style>
