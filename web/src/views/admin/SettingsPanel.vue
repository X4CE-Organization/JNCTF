<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NInput, NButton, NSwitch, NInputNumber, NSelect, NTag, NAlert, NSpin, useMessage } from 'naive-ui';
import { api } from '../../api';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const message = useMessage();
const loading = ref(true);
const values = ref<Record<string, string>>({});
const dirty = ref<Record<string, string>>({});
const activeGroup = ref('site');
const mailTestTo = ref('');
const smsTestPhone = ref('');
const testing = ref(false);

type FieldType = 'string' | 'password' | 'textarea' | 'bool' | 'number' | 'select';

interface Field {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  options?: Array<{ label: string; value: string }>;
}

interface Group {
  id: string;
  title: string;
  hint: string;
  fields: Field[];
}

const bool = (label: string, key: string, hint?: string): Field => ({ key, label, type: 'bool', hint });
const num = (label: string, key: string, hint?: string): Field => ({ key, label, type: 'number', hint });
const str = (label: string, key: string, hint?: string): Field => ({ key, label, type: 'string', hint });

const GROUPS: Group[] = [
  {
    id: 'site',
    title: '站点信息',
    hint: '名称、Logo、页脚与备案',
    fields: [
      str('站点名称', 'site.name'),
      str('站点描述', 'site.description'),
      str('Logo 地址', 'site.logo', '留空则显示默认的字母图标'),
      str('站点图标地址', 'site.favicon'),
      str('页脚文字', 'site.footer'),
      str('版权信息', 'site.copyright'),
      str('主题色', 'site.theme_color', '十六进制，例如 #00a878'),
      str('开源仓库地址', 'site.github'),
      str('联系邮箱', 'site.contact_email'),
      str('联系 QQ', 'site.contact_qq'),
      str('备案号', 'site.icp'),
      str('公安备案号', 'site.police_icp'),
      str('默认语言', 'site.default_locale'),
      str('时区', 'site.timezone'),
      num('每页条数', 'site.page_size'),
      { key: 'site.banner', label: '首页横幅（Markdown）', type: 'textarea' },
      { key: 'site.home_notice', label: '首页提示条', type: 'textarea', hint: '显示在首页顶部，留空则不显示' },
      bool('维护模式', 'site.maintenance', '开启后只有管理员能访问前台'),
      str('维护提示语', 'site.maintenance_notice'),
    ],
  },
  {
    id: 'register',
    title: '注册与登录',
    hint: '注册必填项与登录方式',
    fields: [
      bool('开放注册', 'site.allow_register'),
      bool('注册需要邮箱', 'site.register_require_email'),
      bool('注册需要手机号', 'site.register_require_phone'),
      bool('注册需要邮箱验证码', 'site.need_email_verify', '开启后注册时校验邮箱验证码'),
      bool('注册需要手机验证码', 'site.need_phone_verify'),
      bool('允许邮箱验证码登录', 'site.allow_email_login'),
      bool('允许手机号登录', 'site.allow_phone_login'),
      bool('新用户欢迎通知', 'site.welcome_notify'),
      num('用户名最小长度', 'username.min_length'),
      num('用户名最大长度', 'username.max_length'),
      str('用户名禁止词', 'username.forbid_keywords', '英文逗号分隔'),
      num('密码最小长度', 'password.min_length'),
      bool('密码需含字母', 'password.need_letter'),
      bool('密码需含数字', 'password.need_digit'),
      bool('密码需含符号', 'password.need_symbol'),
    ],
  },
  {
    id: 'security',
    title: '安全',
    hint: '登录限制、验证码与日志',
    fields: [
      num('登录失败锁定次数', 'security.login_fail_limit', '0 表示不锁定'),
      num('锁定时长（分钟）', 'security.login_lock_minutes'),
      num('登录态有效期（小时）', 'security.session_hours'),
      bool('允许 API 令牌', 'security.allow_api_token'),
      bool('注册 IP 限流', 'security.allow_register_ip_limit'),
      num('验证码有效期（秒）', 'security.code_ttl_seconds'),
      num('验证码重发间隔（秒）', 'security.code_resend_seconds'),
      num('验证码每日上限', 'security.code_max_per_day'),
      bool('管理员强制两步验证', 'security.force_2fa_for_admin'),
      bool('同一时间只允许一个会话', 'security.single_session'),
      num('审计日志保留天数', 'security.audit_retention_days'),
    ],
  },
  {
    id: 'mail',
    title: '邮件 SMTP',
    hint: '注册验证、找回密码与通知邮件',
    fields: [
      bool('启用邮件', 'mail.enabled'),
      str('SMTP 服务器', 'mail.host', '例如 smtp.qq.com'),
      num('端口', 'mail.port', '587（STARTTLS）或 465（SSL）'),
      bool('使用 SSL', 'mail.secure', '465 端口一般要开'),
      str('SMTP 用户名', 'mail.username'),
      { key: 'mail.password', label: 'SMTP 授权码 / 密码', type: 'password' },
      str('发件人地址', 'mail.from'),
      str('发件人名称', 'mail.from_name'),
      bool('跳过证书校验', 'mail.tls_insecure', '自签名证书时开启'),
      bool('记录发送日志', 'mail.debug'),
      str('验证码邮件标题', 'mail.verify_subject'),
      bool('工单回复邮件通知', 'mail.notify_on_ticket'),
      bool('题解审核邮件通知', 'mail.notify_on_writeup'),
    ],
  },
  {
    id: 'sms',
    title: '短信',
    hint: '手机号注册与登录验证码',
    fields: [
      bool('启用短信', 'sms.enabled'),
      {
        key: 'sms.provider',
        label: '短信服务商',
        type: 'select',
        options: [
          { label: '不发送（调试）', value: 'none' },
          { label: 'Webhook 网关', value: 'webhook' },
          { label: '阿里云短信', value: 'aliyun' },
        ],
      },
      str('短信签名', 'sms.sign_name'),
      str('模板编号', 'sms.template_code', '模板里的变量名需为 code'),
      str('Webhook 地址', 'sms.webhook_url', '会 POST {phone, code, signName, template}'),
      { key: 'sms.webhook_secret', label: 'Webhook 密钥', type: 'password' },
      str('阿里云 AccessKeyId', 'sms.aliyun_access_key_id'),
      { key: 'sms.aliyun_access_key_secret', label: '阿里云 AccessKeySecret', type: 'password' },
      str('阿里云区域', 'sms.aliyun_region'),
      bool('调试模式回显验证码', 'sms.debug_return_code', '仅在服务商选「不发送」时生效，方便本地自测'),
      str('手机号校验正则', 'sms.phone_regex'),
    ],
  },
  {
    id: 'oauth',
    title: '第三方登录',
    hint: 'GitHub / Google / Gitee / 自定义 OAuth2',
    fields: [
      bool('启用第三方登录', 'oauth.enabled'),
      str('回调地址前缀', 'oauth.callback_base', '留空则用 SITE_URL，反代场景再填'),
      bool('自动创建账号', 'oauth.auto_register'),
      bool('同邮箱自动关联已有账号', 'oauth.bind_by_email'),
      {
        key: 'oauth.default_role',
        label: '新账号默认角色',
        type: 'select',
        options: [
          { label: '普通用户', value: 'USER' },
          { label: '普通管理员', value: 'ADMIN' },
        ],
      },
      bool('启用 GitHub', 'oauth.github.enabled'),
      str('GitHub Client ID', 'oauth.github.client_id'),
      { key: 'oauth.github.client_secret', label: 'GitHub Client Secret', type: 'password' },
      bool('启用 Google', 'oauth.google.enabled'),
      str('Google Client ID', 'oauth.google.client_id'),
      { key: 'oauth.google.client_secret', label: 'Google Client Secret', type: 'password' },
      bool('启用 Gitee', 'oauth.gitee.enabled'),
      str('Gitee Client ID', 'oauth.gitee.client_id'),
      { key: 'oauth.gitee.client_secret', label: 'Gitee Client Secret', type: 'password' },
      bool('启用自定义 OAuth2', 'oauth.custom.enabled'),
      str('显示名称', 'oauth.custom.name'),
      str('授权地址', 'oauth.custom.authorize_url'),
      str('令牌地址', 'oauth.custom.token_url'),
      str('用户信息地址', 'oauth.custom.userinfo_url'),
      str('Scope', 'oauth.custom.scope'),
      str('用户 ID 字段', 'oauth.custom.id_field', '支持 a.b 这种嵌套写法'),
      str('用户名 字段', 'oauth.custom.name_field'),
      str('头像 字段', 'oauth.custom.avatar_field'),
      str('邮箱 字段', 'oauth.custom.email_field'),
      str('Client ID', 'oauth.custom.client_id'),
      { key: 'oauth.custom.client_secret', label: 'Client Secret', type: 'password' },
    ],
  },
  {
    id: 'challenge',
    title: '题目',
    hint: '展示项、提交限制与加分',
    fields: [
      bool('显示题目分值', 'challenge.show_score'),
      bool('显示解出人数', 'challenge.show_solve_count'),
      bool('显示标签', 'challenge.show_tags'),
      bool('显示分类', 'challenge.show_category'),
      num('两次提交最小间隔（秒）', 'challenge.submit_interval_seconds'),
      num('单题最大错误次数', 'challenge.max_attempts', '0 表示不限制'),
      bool('允许发布题解', 'challenge.allow_writeup'),
      bool('题解需要审核', 'challenge.writeup_needs_review'),
      bool('一血加成', 'challenge.blood_bonus'),
      num('一血加成比例（%）', 'challenge.first_blood_ratio'),
      num('二血加成比例（%）', 'challenge.second_blood_ratio'),
      num('三血加成比例（%）', 'challenge.third_blood_ratio'),
      bool('提示解锁扣分', 'challenge.hint_penalty'),
    ],
  },
  {
    id: 'competition',
    title: '比赛',
    hint: '报名、封榜与结算',
    fields: [
      bool('首页显示即将开始', 'competition.show_upcoming'),
      bool('允许团队参赛', 'competition.allow_team_join'),
      num('封榜时长（分钟）', 'competition.freeze_minutes'),
      bool('自动发布成绩', 'competition.auto_publish_result'),
      bool('报名需要审核', 'competition.registration_need_approval'),
    ],
  },
  {
    id: 'scoreboard',
    title: '榜单',
    hint: '排行榜展示范围',
    fields: [
      str('封榜提示语', 'scoreboard.freeze_notice'),
      bool('显示团队榜', 'scoreboard.show_team_rank'),
      bool('显示学校 / 单位', 'scoreboard.show_school'),
      num('榜单最大条数', 'scoreboard.limit'),
      bool('未登录可看榜单', 'scoreboard.anon_visible'),
    ],
  },
  {
    id: 'team',
    title: '团队',
    hint: '建队、规模与邀请',
    fields: [
      bool('允许组队', 'site.allow_team'),
      bool('允许创建队伍', 'site.allow_team_create'),
      num('队伍人数下限', 'site.min_team_size'),
      num('队伍人数上限', 'site.max_team_size'),
      bool('加入需要审核', 'site.team_need_approval'),
      num('邀请码有效期（秒）', 'site.team_invite_seconds', '0 表示不过期'),
    ],
  },
  {
    id: 'upload',
    title: '上传',
    hint: '附件与头像限制',
    fields: [
      num('附件大小上限（MB）', 'upload.max_attachment_mb'),
      num('头像大小上限（MB）', 'upload.max_avatar_mb'),
      num('图片大小上限（MB）', 'upload.max_image_mb'),
      { key: 'upload.allowed_ext', label: '允许的文件后缀', type: 'textarea', hint: '英文逗号分隔' },
      bool('允许外链文件', 'upload.allow_remote'),
    ],
  },
  {
    id: 'docker',
    title: '动态靶机',
    hint: '需要能访问 Docker',
    fields: [
      bool('启用动态靶机', 'docker.enabled', '还需要在 .env 里设置 DOCKER_ENABLED=true'),
      num('靶机存活时间（分钟）', 'docker.instance_ttl_minutes'),
      num('每人同时运行上限', 'docker.max_instance_per_user'),
      num('单容器内存（MB）', 'docker.memory_mb'),
      num('单容器 CPU 核数', 'docker.cpu_limit'),
      bool('前台显示连接地址', 'docker.show_connection'),
    ],
  },
  {
    id: 'notify',
    title: '通知与工单',
    hint: '站内信与工单规则',
    fields: [
      bool('工单回复通知', 'notify.on_ticket_reply'),
      bool('题解审核通知', 'notify.on_writeup_review'),
      bool('公告通知', 'notify.on_announcement'),
      bool('允许游客提工单', 'ticket.allow_guest'),
      num('每人未关闭工单上限', 'ticket.max_open_per_user'),
      num('自动关闭天数', 'ticket.auto_close_days', '0 表示不自动关闭'),
    ],
  },
  {
    id: 'messages',
    title: '私信',
    hint: '一对一私信的开关与限制',
    fields: [
      bool('启用私信', 'messages.enabled'),
      bool('允许陌生人私信', 'messages.allow_strangers', '关闭后普通用户之间只有同队成员能互发'),
      num('单条私信最大长度', 'messages.max_length'),
    ],
  },
];

const currentGroup = computed(() => GROUPS.find((g) => g.id === activeGroup.value) ?? GROUPS[0]!);
const dirtyCount = computed(() => Object.keys(dirty.value).length);
const groupDirty = computed(
  () => currentGroup.value.fields.filter((f) => f.key in dirty.value).length,
);

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

async function resetGroup() {
  await api.post('/api/admin/settings/reset', { keys: currentGroup.value.fields.map((f) => f.key) });
  message.success(`「${currentGroup.value.title}」已恢复默认`);
  await load();
}

async function testMail(send: boolean) {
  testing.value = true;
  try {
    const data = await api.post<any>('/api/admin/mail/test', send ? { to: mailTestTo.value.trim() } : {});
    if (data.ok) message.success(data.stage === 'sent' ? '测试邮件已发出' : 'SMTP 连接正常');
    else {
      const label = data.stage === 'connect' ? '连接失败' : data.stage === 'config' ? '还没配好' : '发送失败';
      message.error(`${label}：${data.error ?? '未知错误'}`);
    }
  } catch (err: any) {
    message.error(err?.message ?? '测试失败');
  } finally {
    testing.value = false;
  }
}

async function testSms() {
  testing.value = true;
  try {
    const data = await api.post<any>('/api/admin/sms/test', { phone: smsTestPhone.value.trim() });
    if (data.ok) message.success(data.devCode ? `已通过调试通道发送，验证码：${data.devCode}` : '测试短信已发出');
    else message.error(data.error ?? '发送失败');
  } catch (err: any) {
    message.error(err?.message ?? '测试失败');
  } finally {
    testing.value = false;
  }
}

onMounted(load);
</script>

<template>
  <n-spin :show="loading">
    <div class="settings-layout">
      <!-- 分组导航 -->
      <aside class="settings-nav">
        <button
          v-for="group in GROUPS"
          :key="group.id"
          class="settings-nav-item"
          :class="activeGroup === group.id ? 'on' : ''"
          @click="activeGroup = group.id"
        >
          <span>{{ group.title }}</span>
          <span v-if="group.fields.some((f) => f.key in dirty)" class="settings-dot" />
        </button>
      </aside>

      <!-- 分组内容 -->
      <section class="jk-panel settings-panel">
        <div class="settings-head">
          <div>
            <h2>{{ currentGroup.title }}</h2>
            <p>{{ currentGroup.hint }}</p>
          </div>
          <div class="settings-actions">
            <n-tag v-if="groupDirty" type="warning" size="small" :bordered="false">本组 {{ groupDirty }} 项未保存</n-tag>
            <n-tag v-else-if="dirtyCount" size="small" :bordered="false">其他分组 {{ dirtyCount }} 项未保存</n-tag>
            <n-button size="small" @click="resetGroup">恢复默认</n-button>
            <n-button size="small" :disabled="!dirtyCount" @click="dirty = {}">放弃修改</n-button>
            <n-button size="small" type="primary" :disabled="!dirtyCount" :loading="testing" @click="save">保存修改</n-button>
          </div>
        </div>

        <!-- 邮件自检 -->
        <n-alert v-if="currentGroup.id === 'mail'" type="info" class="settings-alert">
          配置好之后可以先点「测试连接」，再发一封测试邮件确认能不能收到。
        </n-alert>
        <div v-if="currentGroup.id === 'mail'" class="settings-test">
          <n-input v-model:value="mailTestTo" placeholder="测试收件邮箱（可留空只测连接）" style="max-width: 320px" />
          <n-button size="small" @click="testMail(false)">测试连接</n-button>
          <n-button size="small" type="primary" :disabled="!mailTestTo.trim()" @click="testMail(true)">发送测试邮件</n-button>
        </div>

        <!-- 短信自检 -->
        <n-alert v-if="currentGroup.id === 'sms'" type="info" class="settings-alert">
          通道选「不发送」并打开「调试模式回显验证码」时，验证码会直接返回给前端，方便本地把流程跑通。
        </n-alert>
        <div v-if="currentGroup.id === 'sms'" class="settings-test">
          <n-input v-model:value="smsTestPhone" placeholder="测试手机号" style="max-width: 220px" />
          <n-button size="small" type="primary" :disabled="!smsTestPhone.trim()" @click="testSms">发送测试短信</n-button>
        </div>

        <div class="settings-list">
          <div v-for="field in currentGroup.fields" :key="field.key" class="setting-row">
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
              <n-input
                v-else-if="field.type === 'textarea'"
                :value="current(field.key)"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 6 }"
                @update:value="(v: string) => set(field.key, v)"
              />
              <n-input
                v-else
                :value="current(field.key)"
                :placeholder="field.type === 'password' ? '保持 **** 表示不修改，直接输入新值即覆盖' : ''"
                @update:value="(v: string) => set(field.key, v)"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  </n-spin>
</template>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border: 1px solid var(--jk-border);
  border-radius: var(--jk-radius);
  background: var(--jk-bg-elev);
  position: sticky;
  top: calc(var(--jk-header-h) + 58px);
}

.settings-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--jk-text-2);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}

.settings-nav-item span:first-child {
  flex: 1;
}

.settings-nav-item:hover {
  background: var(--jk-bg-soft);
  color: var(--jk-text);
}

.settings-nav-item.on {
  background: var(--jk-accent-soft);
  color: var(--jk-accent);
  font-weight: 600;
}

.settings-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--jk-amber);
}

.settings-panel {
  min-width: 0;
}

.settings-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--jk-border);
}

.settings-head h2 {
  margin: 0;
  font-size: 16px;
}

.settings-head p {
  margin: 3px 0 0;
  font-size: 12.5px;
  color: var(--jk-muted);
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.settings-alert {
  margin: 14px 0 0;
}

.settings-test {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

@media (max-width: 900px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }

  .settings-nav {
    position: static;
    flex-direction: row;
    overflow-x: auto;
  }
}
</style>
