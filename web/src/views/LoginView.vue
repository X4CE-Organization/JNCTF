<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NCard, NForm, NFormItem, NInput, NButton, NAlert, NSpace } from 'naive-ui';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api } from '../api';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const mode = ref<'password' | 'phone' | 'email'>('password');
const form = ref({ username: '', password: '', totpCode: '' });
const codeForm = ref({ phone: '', email: '', code: '' });
const needTotp = ref(false);
const error = ref('');
const hint = ref('');
const loading = ref(false);
const sending = ref(false);
const countdown = ref(0);
const forgotOpen = ref(false);
const forgot = ref({ account: '', sent: false });

const providers = ref<Array<{ id: string; label: string }>>([]);

const setting = (key: string, fallback = '') => String(auth.meta?.settings[key] ?? fallback);
const allowPhone = computed(() => setting('site.allow_phone_login', 'true') === 'true');
const allowEmail = computed(() => setting('site.allow_email_login', 'true') === 'true');
const modes = computed(() => [
  { key: 'password' as const, label: '密码登录' },
  ...(allowPhone.value ? [{ key: 'phone' as const, label: '手机号登录' }] : []),
  ...(allowEmail.value ? [{ key: 'email' as const, label: '邮箱验证码' }] : []),
]);

function startCountdown() {
  countdown.value = 60;
  const timer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) clearInterval(timer);
  }, 1000);
}

async function sendCode() {
  error.value = '';
  hint.value = '';
  sending.value = true;
  try {
    const kind = mode.value === 'phone' ? 'phone' : 'email';
    const target = kind === 'phone' ? codeForm.value.phone.trim() : codeForm.value.email.trim();
    if (!target) throw new Error(kind === 'phone' ? '请先填写手机号' : '请先填写邮箱');
    const result = await api.post<{ devCode?: string }>('/api/auth/code/' + kind, { [kind]: target, scene: 'login' });
    hint.value = result?.devCode ? `开发模式验证码：${result.devCode}` : '验证码已发送，请查收';
    startCountdown();
  } catch (err: any) {
    error.value = err?.message ?? '发送失败';
  } finally {
    sending.value = false;
  }
}

async function submitPassword() {
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

async function submitCode() {
  error.value = '';
  loading.value = true;
  try {
    if (mode.value === 'phone') await auth.loginWithCode('phone', codeForm.value.phone.trim(), codeForm.value.code.trim());
    else await auth.loginWithCode('email', codeForm.value.email.trim(), codeForm.value.code.trim());
    router.push(String(route.query.redirect || '/'));
  } catch (err: any) {
    error.value = err?.message ?? '登录失败';
  } finally {
    loading.value = false;
  }
}

async function sendReset() {
  await api.post('/api/auth/forgot-password', { account: forgot.value.account });
  forgot.value.sent = true;
}

function oauthLogin(id: string) {
  window.location.href = `/api/auth/oauth/${id}/start?redirect=${encodeURIComponent(String(route.query.redirect || '/'))}`;
}

onMounted(async () => {
  providers.value = await api
    .get<{ items: Array<{ id: string; label: string }> }>('/api/auth/oauth/providers')
    .then((d) => d.items ?? [])
    .catch(() => []);
  if (route.query.error) error.value = String(route.query.error);
  if (allowPhone.value && !allowEmail.value) mode.value = 'phone';
});
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
      <div class="login-tabs">
        <button
          v-for="item in modes"
          :key="item.key"
          class="login-tab"
          :class="mode === item.key ? 'on' : ''"
          @click="mode = item.key; error = ''; hint = ''"
        >
          {{ item.label }}
        </button>
      </div>

      <!-- 密码登录 -->
      <n-form v-if="mode === 'password'" @submit.prevent="submitPassword">
        <n-form-item label="用户名 / 邮箱 / 手机号">
          <n-input v-model:value="form.username" placeholder="请输入用户名、邮箱或手机号" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="form.password" type="password" show-password-on="click" placeholder="请输入密码" @keyup.enter="submitPassword" />
        </n-form-item>
        <n-form-item v-if="needTotp" label="两步验证码">
          <n-input v-model:value="form.totpCode" placeholder="6 位数字" maxlength="6" />
        </n-form-item>
        <n-alert v-if="error" type="error" class="mb-3">{{ error }}</n-alert>
        <n-button type="primary" block :loading="loading" attr-type="submit">登录</n-button>
      </n-form>

      <!-- 验证码登录 -->
      <n-form v-else @submit.prevent="submitCode">
        <n-form-item :label="mode === 'phone' ? '手机号' : '邮箱'">
          <n-input
            v-if="mode === 'phone'"
            v-model:value="codeForm.phone"
            placeholder="请输入手机号"
            maxlength="20"
          />
          <n-input v-else v-model:value="codeForm.email" placeholder="请输入邮箱" />
        </n-form-item>
        <n-form-item label="验证码">
          <n-input v-model:value="codeForm.code" placeholder="6 位数字" maxlength="6" @keyup.enter="submitCode">
            <template #suffix>
              <button class="code-btn" :disabled="countdown > 0 || sending" @click="sendCode">
                {{ countdown > 0 ? `${countdown}s` : sending ? '发送中' : '获取验证码' }}
              </button>
            </template>
          </n-input>
        </n-form-item>
        <n-alert v-if="hint" type="success" class="mb-3">{{ hint }}</n-alert>
        <n-alert v-if="error" type="error" class="mb-3">{{ error }}</n-alert>
        <n-button type="primary" block :loading="loading" attr-type="submit">登录</n-button>
      </n-form>

      <!-- 第三方登录 -->
      <template v-if="providers.length">
        <div class="oauth-divider"><span>第三方登录</span></div>
        <div class="oauth-row">
          <button v-for="p in providers" :key="p.id" class="oauth-btn" @click="oauthLogin(p.id)">
            {{ p.label }}
          </button>
        </div>
      </template>

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

<style scoped>
.login-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  padding: 3px;
  border-radius: 6px;
  background: var(--jk-bg-soft);
}

.login-tab {
  flex: 1;
  padding: 7px 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--jk-text-2);
  font-size: 13px;
  cursor: pointer;
}

.login-tab.on {
  background: var(--jk-bg-elev);
  color: var(--jk-accent);
  font-weight: 600;
  box-shadow: var(--jk-shadow-sm);
}

.code-btn {
  border: none;
  background: transparent;
  color: var(--jk-accent);
  font-size: 12.5px;
  cursor: pointer;
}

.code-btn:disabled {
  color: var(--jk-muted);
  cursor: default;
}

.oauth-divider {
  position: relative;
  margin: 18px 0 12px;
  text-align: center;
}

.oauth-divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--jk-border);
}

.oauth-divider span {
  position: relative;
  padding: 0 10px;
  background: var(--jk-bg-elev);
  font-size: 12px;
  color: var(--jk-muted);
}

.oauth-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.oauth-btn {
  flex: 1;
  min-width: 110px;
  padding: 9px 12px;
  border: 1px solid var(--jk-border);
  border-radius: 5px;
  background: transparent;
  color: var(--jk-text);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.14s ease, color 0.14s ease;
}

.oauth-btn:hover {
  border-color: var(--jk-accent);
  color: var(--jk-accent);
}
</style>
