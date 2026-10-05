<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { NCard, NTag, NSpin, NList, NListItem, NThing, NEmpty, NDescriptions, NDescriptionsItem, NSpace, NAvatar } from 'naive-ui';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { DIFFICULTY_META } from '../theme';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const loading = ref(true);
const profile = ref<any>(null);
const moments = ref<any[]>([]);

async function load() {
  loading.value = true;
  try {
    profile.value = await api.get<any>(`/api/users/${route.params.username}/profile`);
    moments.value = await api
      .get<any>(`/api/moments?username=${encodeURIComponent(String(route.params.username))}&size=5`)
      .then((d) => d.items ?? [])
      .catch(() => []);
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.username, load);
onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <div v-if="profile" class="profile-page">
      <button class="back-btn" title="返回上一页" @click="router.back()">←</button>
      <div class="grid gap-4 lg:grid-cols-[280px_1fr]">
      <n-card>
        <div class="text-center">
          <n-avatar round :size="72" :src="profile.avatar || undefined">{{ profile.displayName.slice(0, 1) }}</n-avatar>
          <h1 class="mt-3 text-lg font-semibold">{{ profile.displayName }}</h1>
          <p class="text-xs opacity-60">@{{ profile.username }}</p>
          <p class="mt-2 text-sm opacity-70">{{ profile.bio || '这个人很神秘，什么都没写' }}</p>
          <RouterLink
            v-if="auth.isLogin && auth.user?.username !== profile.username"
            :to="`/messages?to=${profile.username}`"
            class="profile-dm"
          >
            私信
          </RouterLink>
        </div>
        <n-descriptions class="mt-4" :column="1" size="small" label-placement="left">
          <n-descriptions-item label="等级分">{{ profile.score }}</n-descriptions-item>
          <n-descriptions-item label="积分">{{ profile.points }}</n-descriptions-item>
          <n-descriptions-item label="排名">#{{ profile.globalRank }}</n-descriptions-item>
          <n-descriptions-item label="解题">{{ profile.solveCount }}</n-descriptions-item>
          <n-descriptions-item label="动态">{{ profile.momentCount ?? 0 }}</n-descriptions-item>
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

      <div>
      <n-card title="动态">
        <template #header-extra>
          <RouterLink :to="`/moments?username=${profile.username}`" class="text-indigo-500 hover:underline text-sm">
            全部 →
          </RouterLink>
        </template>
        <n-empty v-if="!moments.length" description="还没有发过动态" />
        <div v-else class="profile-moments">
          <div v-for="m in moments" :key="m.id" class="profile-moment">
            <p>{{ m.content }}</p>
            <div class="profile-moment-meta mono">
              <span>{{ new Date(m.createdAt).toLocaleString() }}</span>
              <span>♥ {{ m.likeCount }}</span>
              <span>💬 {{ m.commentCount }}</span>
            </div>
          </div>
        </div>
      </n-card>

      <n-card title="最近解出的题目" class="mt-4">
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
      </div>
    </div>
  </n-spin>
</template>

<style scoped>
.profile-dm {
  display: inline-block;
  margin-top: 12px;
  padding: 6px 18px;
  border: 1px solid var(--jk-accent);
  border-radius: 5px;
  color: var(--jk-accent);
  font-size: 13px;
  text-decoration: none;
  transition: background 0.14s ease;
}

.profile-dm:hover {
  background: var(--jk-accent-soft);
}

.profile-moments {
  display: flex;
  flex-direction: column;
}

.profile-moment {
  padding: 11px 0;
  border-bottom: 1px dashed var(--jk-border);
}

.profile-moment:last-child {
  border-bottom: 0;
}

.profile-moment p {
  margin: 0 0 5px;
  font-size: 13.5px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.profile-moment-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--jk-muted);
}
</style>
