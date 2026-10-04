<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { NCard, NSpin, NTag, NSpace, NButton, NEllipsis, useMessage } from 'naive-ui';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '../api';
import MarkdownView from '../components/MarkdownView.vue';

const route = useRoute();
const message = useMessage();
const loading = ref(true);
const writeup = ref<any>(null);

async function load() {
  loading.value = true;
  try {
    writeup.value = await api.get<any>(`/api/writeups/${route.params.id}`);
  } catch (err: any) {
    message.error(err?.message ?? '题解不存在');
  } finally {
    loading.value = false;
  }
}

async function like() {
  const data = await api.post<any>(`/api/writeups/${route.params.id}/like`);
  writeup.value.likes = data.likes;
}

watch(() => route.params.id, load);
onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <n-card v-if="writeup">
      <h1 class="text-xl font-semibold">{{ writeup.title }}</h1>
      <n-space class="mt-2" :size="10">
        <RouterLink :to="`/users/${writeup.author.username}`" class="text-indigo-500 hover:underline">
          {{ writeup.author.displayName }}
        </RouterLink>
        <n-tag size="tiny" :bordered="false">{{ writeup.challenge.title }}</n-tag>
        <span class="text-xs opacity-50">{{ new Date(writeup.createdAt).toLocaleString() }}</span>
        <n-button size="tiny" @click="like">👍 {{ writeup.likes }}</n-button>
      </n-space>
      <n-card v-if="writeup.url" size="small" class="mt-4">
        外部链接：<a :href="writeup.url" target="_blank" rel="noreferrer" class="text-indigo-500 hover:underline">{{ writeup.url }}</a>
      </n-card>
      <MarkdownView v-if="writeup.content" class="mt-4" :content="writeup.content" />
    </n-card>
  </n-spin>
</template>
