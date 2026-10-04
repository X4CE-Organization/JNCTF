<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NCard, NInput, NButton, NSpace, NSwitch, NInputNumber, NSelect, NTag, NAlert, useMessage } from 'naive-ui';
import { api } from '../../api';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const values = ref<Record<string, string>>({});
const dirty = ref<Record<string, string>>({});

/** 设置项按分组声明一次，后台自动渲染 */
const GROUPS: Array<{ title: string; hint: string; fields: Array<{ key: string; label: string; type: 'string' | 'bool' | 'number' | 'select'; options?: Array<{ label: string; value: string }>; hint?: string }> }> = [
  {
    title: '站点信息',
    hint: '名称、描述、Logo 与页脚',
    fields: [
      { key: 'site.name', label: '站点名称', type: 'string' },
      { key: 'site.description', label: '站点描述', type: 'string' },
      { key: 'site.logo', label: 'Logo 地址', type: 'string' },
      { key: 'site.favicon', label: '站点图标地址', type: 'string' },
      { key: 'site.footer', label: '页脚文字', type: 'string' },
      { key: 'site.theme_color', label: '主题色', type: 'string' },
      { key: 'site.github', label: '开源仓库地址', type: 'string' },
      { key: 'site.icp', label: '备案号', type: 'string' },
      { key: 'site.contact_email', label: '联系邮箱', type: 'string' },
    ],
  },
  {
    title: '注册与登录',
    hint: '注册开关与邮箱策略',
    fields: [
      { key: 'site.allow_register', label: '开放注册', type: 'bool' },
      { key: 'site.registration_mode', label: '注册必填项', type: 'select', options: [{ label: '都不需要', value: 'none' }, { label: '必须填邮箱', value: 'email' }] },
      { key: 'site.need_email_verify', label: '注册需要邮箱验证', type: 'bool' },
      { key: 'security.login_fail_limit', label: '登录失败锁定次数', type: 'number' },
      { key: 'security.login_lock_minutes', label: '锁定时长（分钟）', type: 'number' },
      { key: 'security.allow_api_token', label: '允许使用 API 令牌', type: 'bool' },
    ],
  },
  {
    title: '答题与榜单',
    hint: '提交限制与榜单展示',
    fields: [
      { key: 'challenge.submit_interval_seconds', label: '两次提交最小间隔（秒）', type: 'number' },
      { key: 'challenge.show_score', label: '前台显示题目分值', type: 'bool' },
      { key: 'challenge.show_solve_count', label: '显示解出人数', type: 'bool' },
      { key: 'challenge.show_tags', label: '显示题目标签', type: 'bool' },
      { key: 'scoreboard.freeze_notice', label: '封榜提示语', type: 'string' },
    ],
  },
  {
    title: '团队与上传',
    hint: '队伍规模与文件限制',
    fields: [
      { key: 'site.allow_team', label: '允许组队', type: 'bool' },
      { key: 'site.max_team_size', label: '队伍人数上限', type: 'number' },
      { key: 'upload.max_attachment_mb', label: '附件大小上限（MB）', type: 'number' },
      { key: 'upload.max_avatar_mb', label: '头像大小上限（MB）', type: 'number' },
    ],
  },
  {
    title: '动态靶机',
    hint: '需要能访问 Docker',
    fields: [
      { key: 'docker.enabled', label: '启用动态靶机', type: 'bool', hint: '还需要在 .env 里设置 DOCKER_ENABLED=true' },
      { key: 'docker.instance_ttl_minutes', label: '靶机存活时间（分钟）', type: 'number' },
      { key: 'docker.max_instance_per_user', label: '每人同时运行上限', type: 'number' },
    ],
  },
];

const dirtyCount = computed(() => Object.keys(dirty.value).length);

function current(key: string): string {
  return dirty.value[key] ?? values.value[key] ?? '';
}

function set(key: string, value: string) {
  dirty.value = { ...dirty.value, [key]: value };
}

async function load() {
  loading.value = true;
  try {
    values.value = await api.get<Record<string, string>>('/api/admin/settings');
    dirty.value = {};
  } finally {
    loading.value = false;
  }
}

async function save() {
  const data = await api.put<any>('/api/admin/settings', { values: dirty.value });
  message.success(`已保存 ${data.changed.length} 项`);
  dirty.value = {};
  await load();
  await auth.reloadMeta();
}

async function resetGroup(group: typeof GROUPS[number]) {
  await api.post('/api/admin/settings/reset', { keys: group.fields.map((f) => f.key) });
  message.success(`「${group.title}」已恢复默认`);
  await load();
}

onMounted(load);
</script>

<template>
  <div class="space-y-3">
    <n-card size="small">
      <n-space align="center">
        <span class="font-medium">系统设置</span>
        <n-tag v-if="dirtyCount" type="warning" size="small">有 {{ dirtyCount }} 项未保存</n-tag>
        <n-space class="ml-auto">
          <n-button v-if="dirtyCount" @click="dirty = {}">放弃修改</n-button>
          <n-button type="primary" :disabled="!dirtyCount" @click="save">保存修改</n-button>
        </n-space>
      </n-space>
    </n-card>

    <n-card v-for="group in GROUPS" :key="group.title" size="small">
      <template #header>
        <n-space align="center"><span>{{ group.title }}</span><span class="text-xs opacity-50">{{ group.hint }}</span></n-space>
      </template>
      <template #header-extra>
        <n-button size="tiny" @click="resetGroup(group)">恢复默认</n-button>
      </template>
      <div class="settings-list">
        <div v-for="field in group.fields" :key="field.key" class="setting-row">
          <div class="setting-label">
            <strong>{{ field.label }}</strong>
            <small v-if="field.hint">{{ field.hint }}</small>
            <code class="setting-key">{{ field.key }}</code>
          </div>
          <div class="setting-control">
            <n-switch
              v-if="field.type === 'bool'"
              :value="current(field.key) === 'true'"
              @update:value="(v: boolean) => set(field.key, v ? 'true' : 'false')"
            />
            <n-select
              v-else-if="field.type === 'select'"
              :value="current(field.key)"
              :options="field.options"
              @update:value="(v: string) => set(field.key, v)"
            />
            <n-input-number
              v-else-if="field.type === 'number'"
              :value="Number(current(field.key))"
              style="width: 100%"
              @update:value="(v: number | null) => set(field.key, String(v ?? 0))"
            />
            <n-input v-else :value="current(field.key)" @update:value="(v: string) => set(field.key, v)" />
          </div>
        </div>
      </div>
    </n-card>
  </div>
</template>
