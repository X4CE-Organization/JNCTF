<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NTag, NButton, NSpace, NTooltip } from 'naive-ui';
import { useRouter } from 'vue-router';
import { DIFFICULTY_META } from '../theme';

const props = defineProps<{ challenge: any; showCategory?: boolean }>();
const router = useRouter();

const difficulty = computed(() => DIFFICULTY_META[props.challenge.difficulty] ?? DIFFICULTY_META.EASY!);
</script>

<template>
  <n-card size="small" hoverable class="h-full" @click="router.push(`/challenges/${challenge.id}`)">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span v-if="challenge.solved" class="text-emerald-500">✓</span>
          <span class="truncate font-medium">{{ challenge.title }}</span>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <n-tag size="tiny" :color="{ color: difficulty.color + '22', textColor: difficulty.color, borderColor: 'transparent' }">
            {{ difficulty.label }}
          </n-tag>
          <n-tag v-if="showCategory && challenge.category" size="tiny" :bordered="false">
            {{ challenge.category.name }}
          </n-tag>
          <n-tag v-for="tag in (challenge.tags ?? []).slice(0, 2)" :key="tag.id" size="tiny" :bordered="false">
            {{ tag.name }}
          </n-tag>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <div class="text-lg font-semibold text-indigo-500">{{ challenge.currentValue ?? challenge.score ?? '—' }}</div>
        <div class="text-xs opacity-50">{{ challenge.solveCount ?? 0 }} 解出</div>
      </div>
    </div>
    <div v-if="challenge.fileCount || challenge.hintCount" class="mt-2 text-xs opacity-50">
      <span v-if="challenge.fileCount">📎 {{ challenge.fileCount }}</span>
      <span v-if="challenge.hintCount" class="ml-2">💡 {{ challenge.hintCount }}</span>
      <span v-if="challenge.requiresContainer" class="ml-2">🐳 靶机</span>
    </div>
  </n-card>
</template>
