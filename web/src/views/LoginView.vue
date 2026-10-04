<script setup lang="ts">
import { ref } from 'vue';
import { NCard, NForm, NFormItem, NInput, NButton, NAlert, NSpace } from 'naive-ui';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api } from '../api';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const form = ref({ username: '', password: '', totpCode: '' });
const needTotp = ref(false);
const error = ref('');
const loading = ref(false);
const forgotOpen = ref(false);
const forgot = ref({ account: '', sent: false });

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const user = await auth.login(form.value.username.trim(), form.value.password, form.value.totpCode || undefined);
    router.push(String(route.query.redirect || '/'));
    if (!user) error.value = '登录成功，但没拿到用户信息';
  } catch (err: any) {
    if (err?.code === 'TOTP_REQUIRED') {
      needTotp.value = true;
      error.value = '该账号开启了两步验证，请输入动态验证码';
    } else {
      error.value = err?.message ?? '登录失败';
    }
  } finally {
    loading.value = false;
  }
}

async function sendReset() {
  await api.post('/api/auth/forgot-password', { account: forgot.value.account });
  forgot.value.sent = true;
}
</script>

<template>
  <div class="mx-auto grid max-w-4xl gap-8 py-10 lg:grid-cols-2">
    <div class="hidden flex-col justify-center lg:flex">
      <h1 class="bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-4xl font-black text-transparent">
        {{ auth.siteName }}
      </h1>
      <p class="mt-3 text-sm opacity-70">{{ auth.meta?.settings['site.description'] }}</p>
      <ul class="mt-6 space-y-2 text-sm opacity-80">
        <li>· 传统解题赛、攻防对抗（AWD）</li>
        <li>· 动态分值、封榜、一血加成</li>
        <li>· 组队、题解、工单、实时榜单</li>
      </ul>
    </div>

    <n-card title="登录">
      <n-form @submit.prevent="submit">
        <n-form-item label="用户名 / 邮箱">
          <n-input v-model:value="form.username" placeholder="请输入用户名或邮箱" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="form.password" type="password" show-password-on="click" placeholder="请输入密码" @keyup.enter="submit" />
        </n-form-item>
        <n-form-item v-if="needTotp" label="两步验证码">
          <n-input v-model:value="form.totpCode" placeholder="6 位数字" maxlength="6" />
        </n-form-item>
        <n-alert v-if="error" type="error" class="mb-3">{{ error }}</n-alert>
        <n-button type="primary" block :loading="loading" attr-type="submit">登录</n-button>
      </n-form>

      <template #footer>
        <n-space justify="space-between">
          <n-button text @click="forgotOpen = !forgotOpen">忘记密码？</n-button>
          <span v-if="auth.meta?.settings['site.allow_register'] === 'true'" class="text-sm">
            还没有账号？<RouterLink to="/register" class="text-indigo-500 hover:underline">立即注册</RouterLink>
          </span>
        </n-space>
      </template>

      <n-card v-if="forgotOpen" size="small" class="mt-4" title="找回密码">
        <template v-if="forgot.sent">
          <p class="text-sm">如果该账号存在并绑定了邮箱，重置链接已经发出，请查收（30 分钟内有效）。</p>
        </template>
        <template v-else>
          <n-input v-model:value="forgot.account" placeholder="用户名或邮箱" />
          <n-button class="mt-3" type="primary" block @click="sendReset">发送重置链接</n-button>
        </template>
      </n-card>
    </n-card>
  </div>
</template>
