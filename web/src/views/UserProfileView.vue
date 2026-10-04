<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { NCard, NTag, NSpin, NList, NListItem, NThing, NEmpty, NDescriptions, NDescriptionsItem, NSpace, NAvatar } from 'naive-ui';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '../api';
import { DIFFICULTY_META } from '../theme';

const route = useRoute();
const loading = ref(true);
const profile = ref<any>(null);

async function load() {
  loading.value = true;
  try {
    profile.value = await api.get<any>(`/api/users/${route.params.username}/profile`);
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.username, load);
onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <div v-if="profile" class="grid gap-4 lg:grid-cols-[280px_1fr]">
      <n-card>
        <div class="text-center">
          <n-avatar round :size="72" :src="profile.avatar || undefined">{{ profile.displayName.slice(0, 1) }}</n-avatar>
          <h1 class="mt-3 text-lg font-semibold">{{ profile.displayName }}</h1>
          <p class="text-xs opacity-60">@{{ profile.username }}</p>
          <p class="mt-2 text-sm opacity-70">{{ profile.bio || '这个人很神秘，什么都没写' }}</p>
        </div>
        <n-descriptions class="mt-4" :column="1" size="small" label-placement="left">
          <n-descriptions-item label="积分">{{ profile.score }}</n-descriptions-item>
          <n-descriptions-item label="排名">#{{ profile.globalRank }}</n-descriptions-item>
          <n-descriptions-item label="解题">{{ profile.solveCount }}</n-descriptions-item>
          <n-descriptions-item label="队伍">
            <RouterLink v-if="profile.team" :to="`/teams/${profile.team.id}`" class="text-indigo-500 hover:underline">
              {{ profile.team.name }}
            </RouterLink>
            <span v-else>无</span>
          </n-descriptions-item>
          <n-descriptions-item v-if="profile.website" label="主页">
            <a :href="profile.website" target="_blank" rel="noreferrer" class="text-indigo-500 hover:underline">链接</a>
          </n-descriptions-item>
          <n-descriptions-item label="注册于">{{ new Date(profile.createdAt).toLocaleDateString() }}</n-descriptions-item>
        </n-descriptions>
      </n-card>

      <n-card title="最近解出的题目">
        <n-empty v-if="!profile.solvedChallenges?.length" description="还没有解出任何题目" />
        <n-list v-else>
          <n-list-item v-for="c in profile.solvedChallenges" :key="c.id">
            <n-thing>
              <template #header>
                <RouterLink :to="`/challenges/${c.id}`" class="hover:underline">{{ c.title }}</RouterLink>
              </template>
              <template #description>
                <n-space :size="6">
                  <n-tag size="tiny" :color="{ color: (DIFFICULTY_META[c.difficulty]?.color ?? '#888') + '22', textColor: DIFFICULTY_META[c.difficulty]?.color, borderColor: 'transparent' }">
                    {{ DIFFICULTY_META[c.difficulty]?.label }}
                  </n-tag>
                  <n-tag v-if="c.firstBlood" size="tiny" type="error">一血</n-tag>
                  <span class="text-xs opacity-50">{{ new Date(c.solvedAt).toLocaleString() }}</span>
                </n-space>
              </template>
            </n-thing>
          </n-list-item>
        </n-list>
      </n-card>
    </div>
  </n-spin>
</template>
