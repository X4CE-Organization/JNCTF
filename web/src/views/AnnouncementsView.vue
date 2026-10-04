<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NSpin } from 'naive-ui';
import { useRouter } from 'vue-router';
import { api } from '../api';
import MarkdownView from '../components/MarkdownView.vue';

const router = useRouter();
const loading = ref(true);
const items = ref<any[]>([]);
const expanded = ref<Set<number>>(new Set());

const LEVEL_LABEL: Record<string, string> = {
  INFO: 'NOTICE',
  WARNING: 'WARN',
  IMPORTANT: 'IMPORTANT',
};

const LEVEL_COLOR: Record<string, string> = {
  INFO: 'var(--jk-text-2)',
  WARNING: 'var(--jk-amber)',
  IMPORTANT: 'var(--jk-danger)',
};

function toggle(id: number) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

onMounted(async () => {
  try {
    const data = await api.get<any>('/api/site/announcements?size=50');
    items.value = data.items ?? [];
    if (items.value[0]) expanded.value = new Set([items.value[0].id]);
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
        <span class="jk-head-icon">!</span>
        <div style="min-width: 0">
          <h1>公告</h1>
          <p><span>站点公告与通知</span></p>
        </div>
      </header>

      <div v-if="!items.length" class="jk-empty">
        <div class="jk-empty-icon">□</div>
        <div>// 暂时没有公告</div>
      </div>

      <section v-for="item in items" :key="item.id" class="jk-panel">
        <div class="ann-head" @click="toggle(item.id)">
          <span
            class="jk-chip"
            :style="{ color: LEVEL_COLOR[item.level] ?? 'var(--jk-text-2)', borderColor: 'var(--jk-border-strong)' }"
          >
            {{ item.pinned ? 'PIN' : LEVEL_LABEL[item.level] ?? 'NOTICE' }}
          </span>
          <h3>{{ item.title }}</h3>
          <span class="mono ann-date">{{ new Date(item.publishedAt).toLocaleDateString() }}</span>
          <span class="ann-toggle">{{ expanded.has(Number(item.id)) ? '收起' : '展开' }}</span>
        </div>
        <div v-if="expanded.has(Number(item.id))" class="ann-body">
          <MarkdownView :content="item.content" />
        </div>
      </section>
    </div>
  </n-spin>
</template>
