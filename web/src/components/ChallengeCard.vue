<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { DIFFICULTY_META } from '../theme';

const props = defineProps<{ challenge: any; showCategory?: boolean }>();

const difficulty = computed(() => DIFFICULTY_META[props.challenge.difficulty] ?? DIFFICULTY_META.EASY!);
const score = computed(() => props.challenge.currentValue ?? props.challenge.score);
</script>

<template>
  <RouterLink
    :to="`/challenges/${challenge.id}`"
    class="jk-challenge"
    :class="challenge.solved ? 'is-solved' : ''"
    :style="{ '--jk-diff-color': difficulty.color }"
  >
    <div class="jk-challenge-top">
      <div style="min-width: 0">
        <div class="jk-challenge-title">
          <span v-if="challenge.solved" style="color: var(--jk-success); margin-right: 4px">✓</span>{{ challenge.title }}
        </div>
        <div v-if="challenge.description" class="jk-challenge-sub" style="margin-top: 4px; line-height: 1.5">
          {{ String(challenge.description).replace(/[#*`>\-]/g, ' ').slice(0, 46) }}
        </div>
      </div>
      <div class="jk-challenge-value">
        <div class="jk-challenge-score">{{ score ?? '—' }}</div>
        <div class="jk-challenge-sub">{{ challenge.solveCount ?? 0 }} 解出</div>
      </div>
    </div>

    <div class="jk-chips">
      <span class="jk-chip diff" :style="{ background: difficulty.color + '1a', color: difficulty.color, borderColor: difficulty.color + '55' }">
        {{ difficulty.short }}
      </span>
      <span v-if="showCategory && challenge.category" class="jk-chip">{{ challenge.category.name }}</span>
      <span v-for="tag in (challenge.tags ?? []).slice(0, 2)" :key="tag.id" class="jk-chip">#{{ tag.name }}</span>
      <span v-if="challenge.requiresContainer" class="jk-chip" title="需要动态靶机">DOCKER</span>
      <span v-if="challenge.fileCount" class="jk-chip">FILE {{ challenge.fileCount }}</span>
      <span v-if="challenge.hintCount" class="jk-chip">HINT {{ challenge.hintCount }}</span>
    </div>
  </RouterLink>
</template>
