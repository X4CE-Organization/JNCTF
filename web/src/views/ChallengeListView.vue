<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NCard, NInput, NSelect, NSpace, NSwitch, NEmpty, NSpin, NTag, NButton, NGrid, NGi } from 'naive-ui';
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
      `/api/challenges${query({ keyword: keyword.value, category: category.value, difficulty: difficulty.value, unsolved: onlyUnsolved.value ? 'true' : '' })}`,
    );
    items.value = data.items ?? [];
    solvedCount.value = data.solvedCount ?? 0;
  } finally {
    loading.value = false;
  }
}

let timer: number | undefined;
watch([category, difficulty, onlyUnsolved], load);
watch(keyword, () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(load, 350);
});
onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <n-card size="small">
      <n-space align="center" :wrap="true">
        <n-input v-model:value="keyword" placeholder="搜索题目" style="width: 220px" clearable />
        <n-select v-model:value="category" :options="categoryOptions" style="width: 150px" />
        <n-select v-model:value="difficulty" :options="difficultyOptions" style="width: 130px" />
        <n-space align="center" :size="6">
          <n-switch v-model:value="onlyUnsolved" size="small" />
          <span class="text-sm">只看未解出</span>
        </n-space>
        <n-tag :bordered="false" class="ml-auto">
          共 {{ items.length }} 题 · 已解出 {{ solvedCount }}
        </n-tag>
      </n-space>
    </n-card>

    <n-spin :show="loading">
      <n-empty v-if="!items.length && !loading" description="没有符合条件的题目" class="py-16" />
      <n-grid v-else :cols="3" :x-gap="12" :y-gap="12" responsive="screen" item-responsive>
        <n-gi v-for="item in items" :key="item.id" span="3 s:3 m:1">
          <ChallengeCard :challenge="item" show-category />
        </n-gi>
      </n-grid>
    </n-spin>
  </div>
</template>
