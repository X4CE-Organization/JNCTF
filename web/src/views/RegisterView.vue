<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NCard, NForm, NFormItem, NInput, NButton, NAlert, NCheckbox } from 'naive-ui';
import { RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api } from '../api';

const auth = useAuthStore();
const router = useRouter();
const form = ref({ username: '', email: '', phone: '', emailCode: '', phoneCode: '', password: '', password2: '', displayName: '' });
const error = ref('');
const hint = ref('');
const loading = ref(false);
const agree = ref(false);
const check = ref<{ available: boolean; reason: string } | null>(null);
const emailCountdown = ref(0);
const phoneCountdown = ref(0);

const setting = (key: string, fallback = 'false') => String(auth.meta?.settings[key] ?? fallback);
const needEmail = computed(() => setting('site.register_require_email') === 'true');
const needPhone = computed(() => setting('site.register_require_phone') === 'true');
const verifyEmail = computed(() => needEmail.value && setting('site.need_email_verify') === 'true');
const verifyPhone = computed(() => needPhone.value && setting('site.need_phone_verify') === 'true');
const passwordMin = computed(() => Number(setting('password.min_length', '8')) || 8);

const providers = ref<Array<{ id: string; label: string }>>([]);

function tick(target: typeof emailCountdown) {
  target.value = 60;
  const timer = setInterval(() => {
    target.value -= 1;
    if (target.value <= 0) clearInterval(timer);
  }, 1000);
}

async function sendCode(kind: 'email' | 'phone') {
  error.value = '';
  hint.value = '';
  const value = kind === 'email' ? form.value.email.trim() : form.value.phone.trim();
  if (!value) {
    error.value = kind === 'email' ? '请先填写邮箱' : '请先填写手机号';
    return;
  }
  try {
    const result = await api.post<{ devCode?: string }>(`/api/auth/code/${kind}`, { [kind]: value, scene: 'register' });
    hint.value = result?.devCode ? `开发模式验证码：${result.devCode}` : '验证码已发送，请查收';
    tick(kind === 'email' ? emailCountdown : phoneCountdown);
  } catch (err: any) {
    error.value = err?.message ?? '发送失败';
  }
}

async function submit() {
  error.value = '';
  if (form.value.password !== form.value.password2) {
    error.value = '两次输入的密码不一致';
    return;
  }
  if (form.value.password.length < passwordMin.value) {
    error.value = `密码至少 ${passwordMin.value} 位`;
    return;
  }
  if (needEmail.value && !form.value.email.trim()) {
    error.value = '本站注册需要填写邮箱';
    return;
  }
  if (needPhone.value && !form.value.phone.trim()) {
    error.value = '本站注册需要填写手机号';
    return;
  }
  if (verifyEmail.value && !form.value.emailCode.trim()) {
    error.value = '请填写邮箱验证码';
    return;
  }
  if (verifyPhone.value && !form.value.phoneCode.trim()) {
    error.value = '请填写手机验证码';
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
      phone: form.value.phone.trim() || undefined,
      emailCode: form.value.emailCode.trim() || undefined,
      phoneCode: form.value.phoneCode.trim() || undefined,
      displayName: form.value.displayName.trim() || undefined,
    });
    router.push(user ? '/' : '/login');
  } catch (err: any) {
    error.value = err?.message ?? '注册失败';
  } finally {
    loading.value = false;
  }
}

function oauthLogin(id: string) {
  window.location.href = `/api/auth/oauth/${id}/start?redirect=/`;
}

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
      check.value = await api
        .get<{ available: boolean; reason: string }>(`/api/auth/check-username?username=${encodeURIComponent(name)}`)
        .catch(() => null);
    }, 400);
  },
);

onMounted(async () => {
  providers.value = await api
    .get<{ items: Array<{ id: string; label: string }> }>('/api/auth/oauth/providers')
    .then((d) => d.items ?? [])
    .catch(() => []);
});
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
          <n-input v-model:value="form.email" placeholder="用于找回密码与接收通知">
            <template v-if="verifyEmail" #suffix>
              <button class="code-btn" :disabled="emailCountdown > 0" @click="sendCode('email')">
                {{ emailCountdown > 0 ? `${emailCountdown}s` : '获取验证码' }}
              </button>
            </template>
          </n-input>
        </n-form-item>
        <n-form-item v-if="verifyEmail" label="邮箱验证码">
          <n-input v-model:value="form.emailCode" placeholder="6 位数字" maxlength="6" />
        </n-form-item>

        <n-form-item :label="needPhone ? '手机号（必填）' : '手机号（选填）'">
          <n-input v-model:value="form.phone" placeholder="用于登录与安全验证" maxlength="20">
            <template v-if="verifyPhone" #suffix>
              <button class="code-btn" :disabled="phoneCountdown > 0" @click="sendCode('phone')">
                {{ phoneCountdown > 0 ? `${phoneCountdown}s` : '获取验证码' }}
              </button>
            </template>
          </n-input>
        </n-form-item>
        <n-form-item v-if="verifyPhone" label="手机验证码">
          <n-input v-model:value="form.phoneCode" placeholder="6 位数字" maxlength="6" />
        </n-form-item>

        <n-form-item label="密码">
          <n-input v-model:value="form.password" type="password" show-password-on="click" :placeholder="`至少 ${passwordMin} 位`" />
        </n-form-item>
        <n-form-item label="确认密码">
          <n-input v-model:value="form.password2" type="password" show-password-on="click" @keyup.enter="submit" />
        </n-form-item>

        <n-alert v-if="hint" type="success" class="mb-3">{{ hint }}</n-alert>
        <n-alert v-if="error" type="error" class="mb-3">{{ error }}</n-alert>
        <n-checkbox v-model:checked="agree">我已阅读并同意本站用户协议</n-checkbox>
        <n-button class="mt-3" type="primary" block :loading="loading" attr-type="submit">注册</n-button>
      </n-form>

      <template v-if="providers.length">
        <div class="oauth-divider"><span>第三方登录注册</span></div>
        <div class="oauth-row">
          <button v-for="p in providers" :key="p.id" class="oauth-btn" @click="oauthLogin(p.id)">{{ p.label }}</button>
        </div>
      </template>

      <template #footer>
        <span class="text-sm">已有账号？<RouterLink to="/login" class="text-indigo-500 hover:underline">去登录</RouterLink></span>
      </template>
    </n-card>
  </div>
</template>

<style scoped>
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
}

.oauth-btn:hover {
  border-color: var(--jk-accent);
  color: var(--jk-accent);
}
</style>
