<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { NAvatar, NButton, NInput, NSpin, useMessage } from 'naive-ui';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const message = useMessage();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const conversations = ref<any[]>([]);
const thread = ref<any[]>([]);
const counterpart = ref<any>(null);
const draft = ref('');
const sending = ref(false);
const keyword = ref('');
const scrollBox = ref<HTMLDivElement | null>(null);

const activeName = computed(() => String(route.query.to ?? ''));
const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return conversations.value;
  return conversations.value.filter(
    (c) => c.user.username.toLowerCase().includes(k) || c.user.displayName.toLowerCase().includes(k),
  );
});

async function loadConversations() {
  conversations.value = (await api.get<any>('/api/messages/conversations')).items ?? [];
}

async function loadThread(username: string) {
  if (!username) {
    thread.value = [];
    counterpart.value = null;
    return;
  }
  try {
    const data = await api.get<any>(`/api/messages/with/${encodeURIComponent(username)}?size=100`);
    thread.value = data.items ?? [];
    counterpart.value = data.user;
    await nextTick();
    if (scrollBox.value) scrollBox.value.scrollTop = scrollBox.value.scrollHeight;
    await loadConversations();
  } catch (err: any) {
    message.error(err?.message ?? '加载失败');
    thread.value = [];
    counterpart.value = null;
  }
}

async function send() {
  const content = draft.value.trim();
  if (!content || !activeName.value) return;
  sending.value = true;
  try {
    await api.post('/api/messages', { to: activeName.value, content });
    draft.value = '';
    await loadThread(activeName.value);
  } catch (err: any) {
    message.error(err?.message ?? '发送失败');
  } finally {
    sending.value = false;
  }
}

function open(username: string) {
  router.push(`/messages?to=${encodeURIComponent(username)}`);
}

watch(
  () => route.query.to,
  (value) => {
    void loadThread(String(value ?? ''));
  },
);

onMounted(async () => {
  loading.value = true;
  try {
    await loadConversations();
    await loadThread(activeName.value);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <n-spin :show="loading">
    <div class="jk-page">
      <header class="jk-head">
        <button class="back-btn" title="返回上一页" @click="router.back()">←</button>
        <span class="jk-head-icon">✉</span>
        <div style="min-width: 0">
          <h1>私信</h1>
          <p><span>共 {{ conversations.length }} 个会话</span><span> · 一对一，别人看不到</span></p>
        </div>
      </header>

      <div class="dm-layout">
        <!-- 会话列表 -->
        <aside class="jk-panel dm-side">
          <n-input v-model:value="keyword" size="small" placeholder="搜索会话" clearable />
          <div class="dm-list">
            <p v-if="!filtered.length" class="dm-empty">还没有会话</p>
            <button
              v-for="c in filtered"
              :key="c.key"
              class="dm-item"
              :class="c.user.username === activeName ? 'on' : ''"
              @click="open(c.user.username)"
            >
              <n-avatar round :size="34" :src="c.user.avatar || undefined">{{ c.user.displayName.slice(0, 1) }}</n-avatar>
              <div class="dm-item-body">
                <div class="dm-item-top">
                  <span class="dm-name">{{ c.user.displayName }}</span>
                  <span class="dm-time mono">{{ new Date(c.lastAt).toLocaleDateString() }}</span>
                </div>
                <div class="dm-preview">
                  <span v-if="c.lastFromMe" class="dm-me">我：</span>{{ c.lastMessage }}
                </div>
              </div>
              <span v-if="c.unread" class="dm-badge">{{ c.unread }}</span>
            </button>
          </div>
        </aside>

        <!-- 聊天窗口 -->
        <section class="jk-panel dm-main">
          <template v-if="counterpart">
            <div class="dm-head">
              <RouterLink :to="`/users/${counterpart.username}`" class="dm-head-user">
                <n-avatar round :size="30" :src="counterpart.avatar || undefined">{{ counterpart.displayName.slice(0, 1) }}</n-avatar>
                <span>{{ counterpart.displayName }}</span>
              </RouterLink>
            </div>
            <div ref="scrollBox" class="dm-thread">
              <p v-if="!thread.length" class="dm-empty">还没有聊天记录，打个招呼吧</p>
              <div v-for="m in thread" :key="m.id" class="dm-row" :class="m.mine ? 'mine' : ''">
                <div class="dm-bubble">{{ m.content }}</div>
                <div class="dm-meta mono">{{ new Date(m.createdAt).toLocaleString() }}</div>
              </div>
            </div>
            <div class="dm-compose">
              <n-input
                v-model:value="draft"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 5 }"
                maxlength="2000"
                placeholder="输入消息，Ctrl / ⌘ + Enter 发送"
                @keydown.ctrl.enter="send"
                @keydown.meta.enter="send"
              />
              <n-button type="primary" :loading="sending" :disabled="!draft.trim()" @click="send">发送</n-button>
            </div>
          </template>
          <div v-else class="dm-placeholder">
            <div class="mono" style="font-size: 26px; color: var(--jk-accent)">✉</div>
            <p>从左边选一个会话，或者去对方主页点「私信」</p>
          </div>
        </section>
      </div>
    </div>
  </n-spin>
</template>

<style scoped>
.dm-layout {
  display: grid;
  grid-template-columns: 288px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.dm-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  max-height: 620px;
}

.dm-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  min-height: 200px;
}

.dm-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.dm-item:hover {
  background: var(--jk-bg-soft);
}

.dm-item.on {
  background: var(--jk-accent-soft);
}

.dm-item-body {
  flex: 1;
  min-width: 0;
}

.dm-item-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}

.dm-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--jk-text);
}

.dm-time {
  font-size: 10.5px;
  color: var(--jk-muted);
}

.dm-preview {
  font-size: 12px;
  color: var(--jk-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dm-me {
  color: var(--jk-text-2);
}

.dm-badge {
  flex: none;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--jk-danger);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}

.dm-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 420px;
}

.dm-head {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--jk-border);
}

.dm-head-user {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: inherit;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.dm-thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  max-height: 460px;
  overflow-y: auto;
  padding: 4px 2px;
}

.dm-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.dm-row.mine {
  align-items: flex-end;
}

.dm-bubble {
  max-width: 78%;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--jk-bg-soft);
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.dm-row.mine .dm-bubble {
  background: var(--jk-accent-soft);
  color: var(--jk-text);
}

.dm-meta {
  font-size: 10.5px;
  color: var(--jk-muted);
}

.dm-compose {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--jk-border);
}

.dm-compose :deep(.n-input) {
  flex: 1;
}

.dm-placeholder,
.dm-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1;
  padding: 40px 12px;
  font-size: 13px;
  color: var(--jk-muted);
  text-align: center;
}

@media (max-width: 860px) {
  .dm-layout {
    grid-template-columns: 1fr;
  }
}
</style>
