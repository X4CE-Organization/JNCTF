<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NInput, NSelect, NSpin, NSwitch, NButton } from 'naive-ui';
import { api, query } from '../api';
import { useAuthStore } from '../stores/auth';
import ChallengeCard from '../components/ChallengeCard.vue';

const auth = useAuthStore();
const loading = ref(true);
const items = ref<any[]>([]);
const solvedCount = ref(0);
const keyword = ref('');
const category = ref('');
const difficulty = ref('');
const onlyUnsolved = ref(false);
const onlySolved = ref(false);

const categoryOptions = computed(() => [
  { label: '全部分类', value: '' },
  ...auth.categories.map((c) => ({ label: c.name, value: c.slug })),
]);

const difficultyOptions = [
  { label: '全部难度', value: '' },
  { label: '入门', value: 'BEGINNER' },
  { label: '简单', value: 'EASY' },
  { label: '中等', value: 'MEDIUM' },
  { label: '困难', value: 'HARD' },
  { label: '地狱', value: 'INSANE' },
];

async function load() {
  loading.value = true;
  try {
    const data = await api.get<any>(
      `/api/challenges${query({
        keyword: keyword.value,
        category: category.value,
        difficulty: difficulty.value,
        unsolved: onlyUnsolved.value ? 'true' : '',
        solved: onlySolved.value ? 'true' : '',
      })}`,
    );
    items.value = data.items ?? [];
    solvedCount.value = data.solvedCount ?? 0;
  } finally {
    loading.value = false;
  }
}

let timer: number | undefined;
watch([category, difficulty, onlyUnsolved, onlySolved], load);
watch(keyword, () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(load, 350);
});
onMounted(load);
</script>

<template>
  <div class="jk-page">
    <header class="jk-head">
      <span class="jk-head-icon">🚩</span>
      <div>
        <h1>题目</h1>
        <p>共 {{ items.length }} 道题，你已解出 {{ solvedCount }} 道</p>
      </div>
      <div class="jk-head-actions">
        <n-button size="small" quaternary @click="onlyUnsolved = !onlyUnsolved; onlySolved = false">
          {{ onlyUnsolved ? '显示全部' : '只看未解出' }}
        </n-button>
      </div>
    </header>

    <div class="jk-toolbar">
      <n-input v-model:value="keyword" placeholder="搜索题目名" style="width: 220px" clearable />
      <n-select v-model:value="category" :options="categoryOptions" style="width: 150px" />
      <n-select v-model:value="difficulty" :options="difficultyOptions" style="width: 130px" />
      <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--jk-text-2)">
        <n-switch v-model:value="onlyUnsolved" size="small" @update:value="onlySolved = false" />
        只看未解出
      </div>
      <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--jk-text-2)">
        <n-switch v-model:value="onlySolved" size="small" @update:value="onlyUnsolved = false" />
        只看已解出
      </div>
    </div>

    <n-spin :show="loading">
      <div v-if="!items.length && !loading" class="jk-empty">
        <div class="jk-empty-icon">🔍</div>
        <div>没有符合条件的题目</div>
        <n-button size="small" quaternary @click="keyword = ''; category = ''; difficulty = ''; onlyUnsolved = false; onlySolved = false">
          清空筛选
        </n-button>
      </div>
      <div v-else class="jk-grid">
        <ChallengeCard v-for="item in items" :key="item.id" :challenge="item" show-category />
      </div>
    </n-spin>
  </div>
</template>
