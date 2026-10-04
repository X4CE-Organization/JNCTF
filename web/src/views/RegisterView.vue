<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NCard, NForm, NFormItem, NInput, NButton, NAlert, NCheckbox } from 'naive-ui';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api } from '../api';

const auth = useAuthStore();
const router = useRouter();
const form = ref({ username: '', email: '', password: '', password2: '', displayName: '' });
const error = ref('');
const loading = ref(false);
const agree = ref(false);
const check = ref<{ available: boolean; reason: string } | null>(null);

const needEmail = computed(() => auth.meta?.settings['site.registration_mode'] !== 'none');

watch(
  () => form.value.username,
  (value) => {
    const name = value.trim();
    if (name.length < 3) {
      check.value = null;
      return;
    }
    setTimeout(async () => {
      if (form.value.username.trim() !== name) return;
      check.value = await api.get<{ available: boolean; reason: string }>(`/api/auth/check-username?username=${encodeURIComponent(name)}`).catch(() => null);
    }, 400);
  },
);

async function submit() {
  error.value = '';
  if (form.value.password !== form.value.password2) {
    error.value = '两次输入的密码不一致';
    return;
  }
  if (!agree.value) {
    error.value = '请先同意用户协议';
    return;
  }
  loading.value = true;
  try {
    const user = await auth.register({
      username: form.value.username.trim(),
      password: form.value.password,
      email: form.value.email.trim() || undefined,
      displayName: form.value.displayName.trim() || undefined,
    });
    router.push(user ? '/' : '/login');
  } catch (err: any) {
    error.value = err?.message ?? '注册失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-md py-10">
    <n-card title="注册账号">
      <n-form @submit.prevent="submit">
        <n-form-item label="用户名">
          <n-input v-model:value="form.username" placeholder="3-20 位，支持中文、字母、数字、下划线、短横线" />
        </n-form-item>
        <div v-if="check" class="mb-3 -mt-2 text-xs" :class="check.available ? 'text-emerald-500' : 'text-rose-500'">
          {{ check.available ? '该用户名可以使用' : check.reason }}
        </div>
        <n-form-item label="昵称">
          <n-input v-model:value="form.displayName" placeholder="选填，默认与用户名相同" />
        </n-form-item>
        <n-form-item :label="needEmail ? '邮箱（必填）' : '邮箱（选填）'">
          <n-input v-model:value="form.email" placeholder="用于找回密码与接收通知" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="form.password" type="password" show-password-on="click" placeholder="至少 8 位" />
        </n-form-item>
        <n-form-item label="确认密码">
          <n-input v-model:value="form.password2" type="password" show-password-on="click" @keyup.enter="submit" />
        </n-form-item>
        <n-checkbox v-model:checked="agree">我已阅读并同意本站用户协议</n-checkbox>
        <n-alert v-if="error" type="error" class="mt-3">{{ error }}</n-alert>
        <n-button class="mt-3" type="primary" block :loading="loading" attr-type="submit">注册</n-button>
      </n-form>
      <template #footer>
        <span class="text-sm">已有账号？<RouterLink to="/login" class="text-indigo-500 hover:underline">去登录</RouterLink></span>
      </template>
    </n-card>
  </div>
</template>
