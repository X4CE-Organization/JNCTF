<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  NCard, NForm, NFormItem, NInput, NButton, NSpace, NAvatar, NList, NListItem, NThing,
  NModal, NAlert, NTag, useMessage,
} from 'naive-ui';
import { api, setTokens } from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const message = useMessage();
const form = ref({ displayName: '', bio: '', website: '', country: '', organization: '', avatar: '' });
const password = ref({ currentPassword: '', newPassword: '' });
const tokens = ref<any[]>([]);
const logs = ref<any[]>([]);
const tokenModal = ref(false);
const newToken = ref('');
const totpSetup = ref<any>(null);
const totpCode = ref('');

const totpEnabled = computed(() => Boolean(auth.user?.totpEnabled));

async function load() {
  form.value = {
    displayName: auth.user?.displayName ?? '',
    bio: auth.user?.bio ?? '',
    website: auth.user?.website ?? '',
    country: auth.user?.country ?? '',
    organization: auth.user?.organization ?? '',
    avatar: auth.user?.avatar ?? '',
  };
  tokens.value = await api.get<any[]>('/api/auth/tokens').catch(() => []);
  logs.value = (await api.get<any>('/api/auth/login-logs').catch(() => ({ items: [] }))).items ?? [];
}

async function saveProfile() {
  await api.put('/api/auth/profile', form.value);
  await auth.refresh();
  message.success('资料已保存');
}

async function uploadAvatar(file: File) {
  const data = await api.upload<{ url: string }>('/api/upload/avatar', file);
  form.value.avatar = data.url;
  await api.put('/api/auth/profile', { avatar: data.url });
  await auth.refresh();
  message.success('头像已更新');
}

async function changePassword() {
  try {
    await api.put('/api/auth/password', password.value);
    message.success('密码已修改');
    password.value = { currentPassword: '', newPassword: '' };
  } catch (err: any) {
    message.error(err?.message ?? '修改失败');
  }
}

async function createToken() {
  const data = await api.post<any>('/api/auth/tokens', { name: `令牌 ${new Date().toLocaleDateString()}` });
  newToken.value = data.token;
  tokenModal.value = true;
  await load();
}

async function revokeToken(id: number) {
  await api.del(`/api/auth/tokens/${id}`);
  message.success('令牌已吊销');
  await load();
}

async function setupTotp() {
  totpSetup.value = await api.post<any>('/api/auth/2fa/setup');
}

async function enableTotp() {
  try {
    await api.post('/api/auth/2fa/enable', { code: totpCode.value });
    message.success('两步验证已开启');
    totpSetup.value = null;
    totpCode.value = '';
    await auth.refresh();
  } catch (err: any) {
    message.error(err?.message ?? '验证码不正确');
  }
}

onMounted(load);
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-start">
    <n-card class="lg:sticky lg:top-20">
      <div class="text-center">
        <n-avatar round :size="72" :src="form.avatar || undefined">{{ (form.displayName || '?').slice(0, 1) }}</n-avatar>
        <div class="mt-2 font-medium">{{ auth.user?.displayName }}</div>
        <div class="text-xs opacity-50">@{{ auth.user?.username }}</div>
        <div class="mt-2 text-sm">{{ auth.user?.score }} 分</div>
      </div>
      <label class="mt-4 block">
        <input
          type="file"
          accept="image/*"
          class="hidden"
          @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) uploadAvatar(f); }"
        />
        <n-button size="small" block tag="span">更换头像</n-button>
      </label>
    </n-card>

    <div class="space-y-4">
      <n-card title="个人资料">
        <n-form>
          <n-form-item label="昵称"><n-input v-model:value="form.displayName" /></n-form-item>
          <n-form-item label="个性签名"><n-input v-model:value="form.bio" type="textarea" :rows="3" /></n-form-item>
          <n-space>
            <n-form-item label="学校 / 单位"><n-input v-model:value="form.organization" /></n-form-item>
            <n-form-item label="国家 / 地区"><n-input v-model:value="form.country" /></n-form-item>
          </n-space>
          <n-form-item label="个人主页"><n-input v-model:value="form.website" placeholder="https://" /></n-form-item>
        </n-form>
        <n-button type="primary" @click="saveProfile">保存资料</n-button>
      </n-card>

      <n-card title="修改密码">
        <n-space vertical>
          <n-input v-model:value="password.currentPassword" type="password" show-password-on="click" placeholder="当前密码" />
          <n-input v-model:value="password.newPassword" type="password" show-password-on="click" placeholder="新密码（至少 8 位）" />
          <n-button @click="changePassword">修改密码</n-button>
        </n-space>
      </n-card>

      <n-card title="两步验证（TOTP）">
        <n-alert type="info" class="mb-3">
          开启后登录需要输入验证器 App 里的 6 位动态码。用 Google Authenticator、1Password、微软验证器等扫描下面的链接即可。
        </n-alert>
        <template v-if="totpEnabled">
          <n-tag type="success">已开启</n-tag>
        </template>
        <template v-else-if="totpSetup">
          <p class="text-sm">密钥：<code>{{ totpSetup.secret }}</code></p>
          <p class="mt-1 break-all text-xs opacity-60">{{ totpSetup.otpauthUrl }}</p>
          <n-space class="mt-3">
            <n-input v-model:value="totpCode" placeholder="输入验证器里的 6 位码" style="width: 200px" />
            <n-button type="primary" @click="enableTotp">确认开启</n-button>
          </n-space>
        </template>
        <template v-else>
          <n-button @click="setupTotp">生成密钥</n-button>
        </template>
      </n-card>

      <n-card title="API 令牌">
        <template #header-extra>
          <n-button size="small" @click="createToken">新建令牌</n-button>
        </template>
        <p class="mb-2 text-xs opacity-60">给脚本 / CI 用。请求时加 <code>Authorization: Token &lt;令牌&gt;</code> 即可。</p>
        <n-list v-if="tokens.length">
          <n-list-item v-for="t in tokens" :key="t.id">
            <n-thing :title="t.name">
              <template #description>
                <span class="text-xs opacity-60">
                  {{ t.prefix }}… · {{ t.lastUsedAt ? `最近使用 ${new Date(t.lastUsedAt).toLocaleString()}` : '从未使用' }}
                </span>
              </template>
            </n-thing>
            <template #suffix>
              <n-button size="tiny" text type="error" @click="revokeToken(t.id)">吊销</n-button>
            </template>
          </n-list-item>
        </n-list>
        <p v-else class="text-sm opacity-50">还没有创建过令牌</p>
      </n-card>

      <n-card title="登录记录">
        <n-list>
          <n-list-item v-for="log in logs.slice(0, 10)" :key="log.id">
            <n-space align="center">
              <n-tag size="tiny" :type="log.success ? 'success' : 'error'">{{ log.success ? '成功' : '失败' }}</n-tag>
              <span class="text-sm">{{ log.ip || '未知 IP' }}</span>
              <span class="ml-auto text-xs opacity-50">{{ new Date(log.createdAt).toLocaleString() }}</span>
            </n-space>
          </n-list-item>
        </n-list>
      </n-card>
    </div>

    <n-modal v-model:show="tokenModal" preset="card" title="令牌已创建" style="max-width: 520px">
      <n-alert type="warning">令牌只会显示这一次，请立刻复制保存。</n-alert>
      <n-input class="mt-3" :value="newToken" readonly />
      <template #footer>
        <n-button type="primary" @click="tokenModal = false">我已保存</n-button>
      </template>
    </n-modal>
  </div>
</template>
