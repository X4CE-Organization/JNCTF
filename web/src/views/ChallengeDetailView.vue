<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  NCard, NInput, NButton, NTag, NSpace, NSpin, NAlert, NDescriptions, NDescriptionsItem,
  NDivider, NList, NListItem, NThing, NEmpty, NPopconfirm, useMessage,
} from 'naive-ui';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import { DIFFICULTY_META } from '../theme';
import MarkdownView from '../components/MarkdownView.vue';

const route = useRoute();
const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const challenge = ref<any>(null);
const flag = ref('');
const submitting = ref(false);
const instance = ref<any>(null);
const instanceLoading = ref(false);

const difficulty = computed(() => DIFFICULTY_META[challenge.value?.difficulty] ?? DIFFICULTY_META.EASY!);
const solved = computed(() => Boolean(challenge.value?.solved));

async function load() {
  loading.value = true;
  try {
    challenge.value = await api.get<any>(`/api/challenges/${route.params.id}`);
    instance.value = challenge.value.instance;
  } catch (err: any) {
    message.error(err?.message ?? '题目加载失败');
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!flag.value.trim()) return;
  submitting.value = true;
  try {
    const result = await api.post<any>(`/api/challenges/${route.params.id}/submit`, { flag: flag.value.trim() });
    if (result.status === 'CORRECT') {
      message.success(result.message);
      flag.value = '';
      await load();
    } else {
      message.error(result.message);
    }
  } catch (err: any) {
    message.error(err?.message ?? '提交失败');
  } finally {
    submitting.value = false;
  }
}

async function unlockHint(hint: any) {
  try {
    const result = await api.post<any>(`/api/challenges/${route.params.id}/hints/${hint.id}/unlock`);
    message.success(result.cost ? `已解锁，扣除 ${result.cost} 分` : '已解锁');
    await load();
  } catch (err: any) {
    message.error(err?.message ?? '解锁失败');
  }
}

async function startInstance() {
  instanceLoading.value = true;
  try {
    instance.value = await api.post<any>(`/api/challenges/${route.params.id}/instance`);
    message[instance.value.status === 'RUNNING' ? 'success' : 'error'](instance.value.message ?? '');
  } catch (err: any) {
    message.error(err?.message ?? '启动失败');
  } finally {
    instanceLoading.value = false;
  }
}

async function stopInstance() {
  await api.del(`/api/challenges/${route.params.id}/instance`);
  instance.value = null;
  message.success('已停止靶机');
}

async function download(file: any) {
  const data = await api.get<any>(`/api/challenges/${route.params.id}/files/${file.id}/download`);
  window.open(data.url, '_blank');
}

watch(() => route.params.id, load);
onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <div v-if="challenge" class="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div class="space-y-4">
        <n-card>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 class="text-xl font-semibold">
                <span v-if="solved" class="mr-1 text-emerald-500">✓</span>{{ challenge.title }}
              </h1>
              <n-space class="mt-2" :size="6">
                <n-tag size="small" :color="{ color: difficulty.color + '22', textColor: difficulty.color, borderColor: 'transparent' }">
                  {{ difficulty.label }}
                </n-tag>
                <n-tag v-if="challenge.category" size="small" :bordered="false">{{ challenge.category.name }}</n-tag>
                <n-tag v-for="tag in challenge.tags" :key="tag.id" size="small" :bordered="false">{{ tag.name }}</n-tag>
              </n-space>
            </div>
            <div class="text-right">
              <div class="text-2xl font-bold text-indigo-500">{{ challenge.currentValue ?? challenge.score }}</div>
              <div class="text-xs opacity-50">
                {{ challenge.scoringType === 'DYNAMIC' ? `动态分 · 最低 ${challenge.minScore}` : '固定分' }}
              </div>
            </div>
          </div>
        </n-card>

        <n-card title="题目描述">
          <MarkdownView :content="challenge.description" />
          <p v-if="!challenge.description" class="text-sm opacity-50">这道题还没有写描述</p>
          <n-alert v-if="challenge.hintPreview" type="info" class="mt-3">{{ challenge.hintPreview }}</n-alert>
        </n-card>

        <n-card v-if="challenge.files?.length" title="附件">
          <n-list>
            <n-list-item v-for="file in challenge.files" :key="file.id">
              <n-thing :title="file.filename">
                <template #description>
                  {{ (file.size / 1024).toFixed(1) }} KB · 下载 {{ file.downloads }} 次
                </template>
                <template #footer>
                  <n-button size="small" :disabled="!challenge.allowDownload" @click="download(file)">下载</n-button>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </n-card>

        <n-card v-if="challenge.hints?.length" title="提示">
          <n-list>
            <n-list-item v-for="hint in challenge.hints" :key="hint.id">
              <template v-if="hint.unlocked">
                <MarkdownView :content="hint.content" />
              </template>
              <template v-else>
                <n-space align="center">
                  <span class="opacity-60">解锁这条提示需要 {{ hint.cost }} 分</span>
                  <n-popconfirm @positive-click="unlockHint(hint)">
                    <template #trigger><n-button size="small" type="primary" ghost>解锁</n-button></template>
                    确定花费 {{ hint.cost }} 分解锁？
                  </n-popconfirm>
                </n-space>
              </template>
            </n-list-item>
          </n-list>
        </n-card>

        <n-card v-if="challenge.solves?.length" title="解题记录">
          <n-list>
            <n-list-item v-for="item in challenge.solves" :key="item.id">
              <n-space align="center">
                <n-tag size="tiny" :type="item.rank === 1 ? 'error' : item.rank <= 3 ? 'warning' : 'default'">
                  #{{ item.rank }}
                </n-tag>
                <RouterLink :to="`/users/${item.user.username}`" class="font-medium hover:underline">
                  {{ item.user.displayName }}
                </RouterLink>
                <span class="ml-auto text-xs opacity-50">{{ new Date(item.createdAt).toLocaleString() }}</span>
              </n-space>
            </n-list-item>
          </n-list>
        </n-card>
      </div>

      <div class="space-y-4">
        <n-card title="提交 flag">
          <n-alert v-if="solved" type="success" class="mb-3">你已经解出这道题了</n-alert>
          <n-input
            v-model:value="flag"
            placeholder="flag{...}"
            :disabled="solved || !auth.isLogin"
            @keyup.enter="submit"
          />
          <n-button
            class="mt-3"
            type="primary"
            block
            :loading="submitting"
            :disabled="solved || !auth.isLogin"
            @click="submit"
          >
            {{ solved ? '已解出' : '提交' }}
          </n-button>
          <p v-if="!auth.isLogin" class="mt-2 text-center text-xs opacity-60">
            <RouterLink to="/login" class="text-indigo-500 hover:underline">登录</RouterLink> 后才能提交
          </p>
        </n-card>

        <n-card v-if="challenge.requiresContainer" title="靶机">
          <template v-if="instance?.status === 'RUNNING'">
            <n-descriptions :column="1" size="small" label-placement="left">
              <n-descriptions-item label="连接地址">
                <code>{{ instance.connection }}</code>
              </n-descriptions-item>
              <n-descriptions-item label="到期时间">{{ new Date(instance.expiresAt).toLocaleString() }}</n-descriptions-item>
            </n-descriptions>
            <n-button class="mt-3" block size="small" @click="stopInstance">停止靶机</n-button>
          </template>
          <template v-else-if="instance?.status === 'FAILED'">
            <n-alert type="error">{{ instance.errorMessage || '靶机启动失败' }}</n-alert>
            <n-button class="mt-3" block size="small" :loading="instanceLoading" @click="startInstance">重试</n-button>
          </template>
          <template v-else>
            <p class="text-sm opacity-70">这道题需要启动一台独立靶机。</p>
            <n-button class="mt-3" type="primary" block :loading="instanceLoading" :disabled="!auth.isLogin" @click="startInstance">
              启动靶机
            </n-button>
          </template>
        </n-card>

        <n-card title="题目信息" size="small">
          <n-descriptions :column="1" size="small" label-placement="left">
            <n-descriptions-item label="解出人数">{{ challenge.solveCount ?? 0 }}</n-descriptions-item>
            <n-descriptions-item label="提交次数">{{ challenge.attemptCount }}</n-descriptions-item>
            <n-descriptions-item v-if="challenge.maxAttempts" label="提交上限">{{ challenge.maxAttempts }}</n-descriptions-item>
            <n-descriptions-item label="出题人">
              <RouterLink v-if="challenge.author" :to="`/users/${challenge.author.username}`" class="hover:underline">
                {{ challenge.author.displayName }}
              </RouterLink>
              <span v-else>—</span>
            </n-descriptions-item>
          </n-descriptions>
        </n-card>
      </div>
    </div>
  </n-spin>
</template>
