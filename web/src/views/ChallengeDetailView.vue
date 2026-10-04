<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NButton, NInput, NSpin, useMessage, NPopconfirm } from 'naive-ui';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { useAuthStore } from '../stores/auth';
import { DIFFICULTY_META } from '../theme';
import MarkdownView from '../components/MarkdownView.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const message = useMessage();

const loading = ref(true);
const challenge = ref<any>(null);
const flag = ref('');
const submitting = ref(false);
const instance = ref<any>(null);
const starting = ref(false);

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
  starting.value = true;
  try {
    instance.value = await api.post<any>(`/api/challenges/${route.params.id}/instance`);
    message[instance.value.status === 'RUNNING' ? 'success' : 'error'](instance.value.message ?? '');
  } catch (err: any) {
    message.error(err?.message ?? '启动失败');
  } finally {
    starting.value = false;
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
    <div v-if="challenge" class="jk-page">
      <header class="jk-head">
        <button class="back-btn" title="返回题库" @click="router.push('/challenges')">←</button>
        <span class="jk-head-icon" :style="{ background: difficulty.color }">{{ solved ? '✓' : '🚩' }}</span>
        <div style="min-width: 0">
          <h1>{{ challenge.title }}</h1>
          <p>
            <span :style="{ color: difficulty.color, fontWeight: 600 }">{{ difficulty.label }}</span>
            <span v-if="challenge.category"> · {{ challenge.category.name }}</span>
            <span> · {{ challenge.solveCount ?? 0 }} 人解出</span>
          </p>
        </div>
        <div class="jk-head-actions">
          <div style="text-align: right">
            <div class="score-num">{{ challenge.currentValue ?? challenge.score }}</div>
            <div class="score-label">
              {{ challenge.scoringType === 'DYNAMIC' ? `动态分 · 最低 ${challenge.minScore}` : '固定分' }}
            </div>
          </div>
        </div>
      </header>

      <div class="detail-grid">
        <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0">
          <section class="jk-panel">
            <div class="jk-section"><h2>题目描述</h2></div>
            <MarkdownView v-if="challenge.description" :content="challenge.description" />
            <p v-else style="color: var(--jk-muted); font-size: 13px">这道题还没有写描述</p>
            <div v-if="challenge.hintPreview" class="hint-preview">{{ challenge.hintPreview }}</div>
            <div v-if="challenge.tags?.length" class="jk-chips" style="margin-top: 14px">
              <span v-for="tag in challenge.tags" :key="tag.id" class="jk-chip">#{{ tag.name }}</span>
            </div>
          </section>

          <section v-if="challenge.files?.length" class="jk-panel">
            <div class="jk-section"><h2>附件</h2><span class="count">{{ challenge.files.length }}</span></div>
            <div v-for="file in challenge.files" :key="file.id" class="jk-list-item">
              <span style="font-size: 18px; opacity: 0.7">📎</span>
              <div style="min-width: 0; flex: 1">
                <div style="font-weight: 500; font-size: 14px">{{ file.filename }}</div>
                <div style="font-size: 12px; color: var(--jk-muted)">
                  {{ (file.size / 1024).toFixed(1) }} KB · 已下载 {{ file.downloads }} 次
                </div>
              </div>
              <n-button size="small" :disabled="!challenge.allowDownload" @click="download(file)">下载</n-button>
            </div>
          </section>

          <section v-if="challenge.hints?.length" class="jk-panel">
            <div class="jk-section"><h2>提示</h2><span class="count">{{ challenge.hints.length }}</span></div>
            <div v-for="hint in challenge.hints" :key="hint.id" class="hint-item">
              <template v-if="hint.unlocked">
                <MarkdownView :content="hint.content" />
              </template>
              <template v-else>
                <span style="font-size: 13px; color: var(--jk-muted)">解锁这条提示需要 {{ hint.cost }} 分</span>
                <n-popconfirm @positive-click="unlockHint(hint)">
                  <template #trigger><n-button size="small" type="primary" ghost>解锁</n-button></template>
                  确定花费 {{ hint.cost }} 分解锁？
                </n-popconfirm>
              </template>
            </div>
          </section>

          <section v-if="challenge.solves?.length" class="jk-panel">
            <div class="jk-section"><h2>解题记录</h2><span class="count">前 {{ challenge.solves.length }}</span></div>
            <div v-for="item in challenge.solves" :key="item.id" class="jk-list-item">
              <span class="jk-rank" :class="item.rank <= 3 ? `r${item.rank}` : ''">#{{ item.rank }}</span>
              <RouterLink :to="`/users/${item.user.username}`" style="font-weight: 500; color: inherit; text-decoration: none; flex: 1">
                {{ item.user.displayName }}
              </RouterLink>
              <span style="font-size: 12px; color: var(--jk-muted)">{{ new Date(item.createdAt).toLocaleString() }}</span>
            </div>
          </section>
        </div>

        <aside style="display: flex; flex-direction: column; gap: 16px">
          <section class="jk-panel">
            <div class="jk-section"><h2>提交 flag</h2></div>
            <div v-if="solved" class="solved-badge">✓ 你已经解出这道题了</div>
            <n-input v-model:value="flag" placeholder="flag{...}" :disabled="solved || !auth.isLogin" @keyup.enter="submit" />
            <n-button class="submit-btn" type="primary" block :loading="submitting" :disabled="solved || !auth.isLogin" @click="submit">
              {{ solved ? '已解出' : '提交' }}
            </n-button>
            <p v-if="!auth.isLogin" class="login-tip"><RouterLink to="/login">登录</RouterLink> 后才能提交</p>
          </section>

          <section v-if="challenge.requiresContainer" class="jk-panel">
            <div class="jk-section"><h2>靶机</h2></div>
            <template v-if="instance?.status === 'RUNNING'">
              <div class="kv"><span>连接地址</span><code>{{ instance.connection }}</code></div>
              <div class="kv"><span>到期时间</span><span>{{ new Date(instance.expiresAt).toLocaleString() }}</span></div>
              <n-button class="submit-btn" block size="small" @click="stopInstance">停止靶机</n-button>
            </template>
            <template v-else-if="instance?.status === 'FAILED'">
              <div class="fail">{{ instance.errorMessage || '靶机启动失败' }}</div>
              <n-button class="submit-btn" block size="small" :loading="starting" @click="startInstance">重试</n-button>
            </template>
            <template v-else>
              <p style="font-size: 13px; color: var(--jk-muted)">这道题需要启动一台独立靶机。</p>
              <n-button class="submit-btn" type="primary" block :loading="starting" :disabled="!auth.isLogin" @click="startInstance">
                启动靶机
              </n-button>
            </template>
          </section>

          <section class="jk-panel">
            <div class="jk-section"><h2>题目信息</h2></div>
            <div class="kv"><span>解出人数</span><b>{{ challenge.solveCount ?? 0 }}</b></div>
            <div class="kv"><span>提交次数</span><b>{{ challenge.attemptCount }}</b></div>
            <div v-if="challenge.maxAttempts" class="kv"><span>提交上限</span><b>{{ challenge.maxAttempts }}</b></div>
            <div class="kv">
              <span>出题人</span>
              <RouterLink v-if="challenge.author" :to="`/users/${challenge.author.username}`" style="color: var(--jk-primary); text-decoration: none">
                {{ challenge.author.displayName }}
              </RouterLink>
              <span v-else>—</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  </n-spin>
</template>
