<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NCard, NSpin, NButton, NAlert } from 'naive-ui';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api, setTokens } from '../api';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const status = ref<'working' | 'done' | 'failed'>('working');
const error = ref('');

onMounted(async () => {
  const failure = String(route.query.error ?? '');
  const ticket = String(route.query.ticket ?? '');
  if (failure) {
    status.value = 'failed';
    error.value = failure;
    return;
  }
  if (!ticket) {
    status.value = 'failed';
    error.value = '缺少登录票据，请重新发起第三方登录';
    return;
  }
  try {
    const data = await api.post<{ accessToken: string; refreshToken: string; user: any }>('/api/auth/oauth/exchange', { ticket });
    setTokens(data.accessToken, data.refreshToken);
    await auth.refresh();
    status.value = 'done';
    const target = String(route.query.redirect ?? '/');
    router.replace(target.startsWith('/') ? target : '/');
  } catch (err: any) {
    status.value = 'failed';
    error.value = err?.message ?? '第三方登录失败';
  }
});
</script>

<template>
  <div class="mx-auto max-w-md py-16">
    <n-card>
      <n-spin :show="status === 'working'">
        <div class="oauth-callback">
          <template v-if="status === 'working'">
            <div class="mono oauth-icon">···</div>
            <h2>正在完成登录</h2>
            <p>正在用第三方账号换取本站令牌，请稍候。</p>
          </template>
          <template v-else-if="status === 'failed'">
            <div class="mono oauth-icon failed">!</div>
            <h2>登录失败</h2>
            <n-alert type="error" class="mt-3">{{ error }}</n-alert>
            <div class="mt-4 flex justify-center gap-3">
              <n-button @click="router.push('/login')">返回登录</n-button>
              <RouterLink to="/register"><n-button type="primary">注册新账号</n-button></RouterLink>
            </div>
          </template>
        </div>
      </n-spin>
    </n-card>
  </div>
</template>

<style scoped>
.oauth-callback {
  text-align: center;
}

.oauth-callback h2 {
  margin: 12px 0 4px;
  font-size: 17px;
}

.oauth-callback p {
  margin: 0;
  font-size: 13px;
  color: var(--jk-muted);
}

.oauth-icon {
  font-size: 26px;
  color: var(--jk-accent);
}

.oauth-icon.failed {
  color: var(--jk-danger);
}
</style>
