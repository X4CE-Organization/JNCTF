import { prisma } from './prisma.js';
import { cacheClear } from './redis.js';

/**
 * 站点设置。所有可调项在这里声明一次：key -> 默认值。
 * 数据库里没有记录就走默认值，所以升级不会因为缺项报错。
 *
 * 约定：
 * - 键名用 `分组.项目`，分组名和后台「系统设置」的标签页一一对应
 * - 任何不在 SETTING_DEFAULTS 里的键都会被写入接口忽略，避免脏数据
 * - SECRET_KEYS 里的值在读取时会被打码，前端回传打码值时跳过更新
 */
export const SETTING_DEFAULTS: Record<string, string> = {
  /* ---------------------------------------------------------- 站点信息 */
  'site.name': 'JNCTF',
  'site.description': '一个开源的 CTF 竞赛平台',
  'site.logo': '',
  'site.favicon': '',
  'site.footer': 'Powered by JNCTF',
  'site.copyright': '© 2026 X4CE',
  'site.theme_color': '#00a878',
  'site.icp': '',
  'site.police_icp': '',
  'site.github': 'https://github.com/x4ce-organization/JNCTF',
  'site.contact_email': '',
  'site.contact_qq': '',
  'site.banner': '',
  'site.default_locale': 'zh-CN',
  'site.timezone': 'Asia/Shanghai',
  'site.page_size': '20',
  'site.home_notice': '',
  'site.maintenance': 'false',
  'site.maintenance_notice': '站点正在维护，请稍后再来',

  /* -------------------------------------------------------- 注册与登录 */
  'site.allow_register': 'true',
  'site.register_require_email': 'false',
  'site.register_require_phone': 'false',
  'site.need_email_verify': 'false',
  'site.need_phone_verify': 'false',
  'site.allow_email_login': 'true',
  'site.allow_phone_login': 'true',
  'site.welcome_notify': 'true',
  // 保留键：老版本用单选控制注册必填项，现在换成两个开关，这里只做兜底
  'site.registration_mode': 'none',
  'username.min_length': '3',
  'username.max_length': '20',
  'username.forbid_keywords': 'admin,root,system,support,official',
  'password.min_length': '8',
  'password.need_letter': 'true',
  'password.need_digit': 'true',
  'password.need_symbol': 'false',

  /* ------------------------------------------------------------ 安全 */
  'security.login_fail_limit': '10',
  'security.login_lock_minutes': '15',
  'security.session_hours': '120',
  'security.allow_api_token': 'true',
  'security.allow_register_ip_limit': 'true',
  'security.code_ttl_seconds': '300',
  'security.code_resend_seconds': '60',
  'security.code_max_per_day': '10',
  'security.force_2fa_for_admin': 'false',
  'security.single_session': 'false',
  'security.audit_retention_days': '180',

  /* -------------------------------------------------------- 邮件 SMTP */
  'mail.enabled': 'false',
  'mail.host': '',
  'mail.port': '587',
  'mail.secure': 'false',
  'mail.username': '',
  'mail.password': '',
  'mail.from': '',
  'mail.from_name': 'JNCTF',
  'mail.tls_insecure': 'false',
  'mail.debug': 'false',
  'mail.verify_subject': '邮箱验证码',
  'mail.notify_on_ticket': 'true',
  'mail.notify_on_writeup': 'true',

  /* ------------------------------------------------------------ 短信 */
  'sms.enabled': 'false',
  // none / webhook / aliyun
  'sms.provider': 'none',
  'sms.sign_name': '',
  'sms.template_code': '',
  'sms.webhook_url': '',
  'sms.webhook_secret': '',
  'sms.aliyun_access_key_id': '',
  'sms.aliyun_access_key_secret': '',
  'sms.aliyun_region': 'cn-hangzhou',
  'sms.debug_return_code': 'false',
  'sms.phone_regex': '^1[3-9]\\d{9}$',

  /* --------------------------------------------------- 第三方登录 OAuth */
  'oauth.enabled': 'false',
  // 回调地址前缀，留空则用 SITE_URL；反向代理 / 多域名时填这里
  'oauth.callback_base': '',
  'oauth.auto_register': 'true',
  'oauth.bind_by_email': 'true',
  'oauth.default_role': 'USER',
  'oauth.github.enabled': 'false',
  'oauth.github.client_id': '',
  'oauth.github.client_secret': '',
  'oauth.google.enabled': 'false',
  'oauth.google.client_id': '',
  'oauth.google.client_secret': '',
  'oauth.gitee.enabled': 'false',
  'oauth.gitee.client_id': '',
  'oauth.gitee.client_secret': '',
  'oauth.custom.enabled': 'false',
  'oauth.custom.name': '自定义',
  'oauth.custom.authorize_url': '',
  'oauth.custom.token_url': '',
  'oauth.custom.userinfo_url': '',
  'oauth.custom.scope': '',
  'oauth.custom.id_field': 'id',
  'oauth.custom.name_field': 'name',
  'oauth.custom.avatar_field': 'avatar',
  'oauth.custom.email_field': 'email',
  'oauth.custom.client_id': '',
  'oauth.custom.client_secret': '',

  /* ------------------------------------------------------------ 题目 */
  'challenge.show_score': 'true',
  'challenge.show_solve_count': 'true',
  'challenge.show_tags': 'true',
  'challenge.show_category': 'true',
  'challenge.submit_interval_seconds': '5',
  'challenge.max_attempts': '0',
  'challenge.allow_writeup': 'true',
  'challenge.writeup_needs_review': 'true',
  'challenge.blood_bonus': 'true',
  'challenge.first_blood_ratio': '10',
  'challenge.second_blood_ratio': '6',
  'challenge.third_blood_ratio': '3',
  'challenge.hint_penalty': 'true',

  /* ------------------------------------------------------------ 比赛 */
  'competition.show_upcoming': 'true',
  'competition.allow_team_join': 'true',
  'competition.freeze_minutes': '30',
  'competition.auto_publish_result': 'true',
  'competition.registration_need_approval': 'false',

  /* ------------------------------------------------------ 榜单与展示 */
  'scoreboard.freeze_notice': '比赛最后 30 分钟封榜，最终排名以结算为准',
  'scoreboard.show_team_rank': 'true',
  'scoreboard.show_school': 'true',
  'scoreboard.limit': '200',
  'scoreboard.anon_visible': 'true',

  /* ------------------------------------------------------------ 团队 */
  'site.allow_team': 'true',
  'site.allow_team_create': 'true',
  'site.max_team_size': '4',
  'site.min_team_size': '1',
  'site.team_need_approval': 'false',
  'site.team_invite_seconds': '0',

  /* ------------------------------------------------------------ 上传 */
  'upload.max_attachment_mb': '100',
  'upload.max_avatar_mb': '4',
  'upload.max_image_mb': '8',
  'upload.allowed_ext': 'zip,rar,7z,tar,gz,png,jpg,jpeg,gif,webp,pdf,txt,md,py,c,cpp,jar',
  'upload.allow_remote': 'false',

  /* -------------------------------------------------------- 动态靶机 */
  'docker.enabled': 'false',
  'docker.instance_ttl_minutes': '60',
  'docker.max_instance_per_user': '2',
  'docker.memory_mb': '256',
  'docker.cpu_limit': '0.5',
  'docker.show_connection': 'true',

  /* -------------------------------------------------------- 通知与工单 */
  'notify.on_ticket_reply': 'true',
  'notify.on_writeup_review': 'true',
  'notify.on_announcement': 'true',
  'ticket.allow_guest': 'false',
  'ticket.max_open_per_user': '5',
  'ticket.auto_close_days': '7',

  /* -------------------------------------------------------------- 积分 */
  'points.enabled': 'true',
  'points.per_solve': '1',
  'points.first_blood_bonus': '2',
  'points.per_moment': '1',
  'points.per_article': '3',
  'points.per_discussion': '1',
  'points.allow_negative': 'false',

  /* -------------------------------------------------------------- 商店 */
  'shop.enabled': 'true',
  'shop.title': '积分商店',
  'shop.notice': '做一题得一点积分，攒够了就能在这里换出题资格和办赛资格。',

  /* ------------------------------------------------------------ 社区 */
  'community.moment_enabled': 'true',
  'community.moment_max_images': '9',
  'community.moment_max_length': '2000',
  'community.moment_need_review': 'false',
  'community.discussion_enabled': 'true',
  'community.discussion_boards': '综合讨论,题目求助,技术分享,站务反馈',
  'community.article_enabled': 'true',
  'community.article_need_review': 'false',
  'community.article_categories': '综合,学习笔记,CTF 入门,逆向,Web,密码学,杂项',
  'community.allow_user_challenge': 'true',
  'community.allow_user_competition': 'true',

  /* -------------------------------------------------------------- 私信 */
  'messages.enabled': 'true',
  'messages.allow_strangers': 'true',
  'messages.max_length': '2000',
};

/** 对游客公开的设置项（绝不能包含密钥类） */
export const PUBLIC_KEYS = [
  'site.name',
  'site.description',
  'site.logo',
  'site.favicon',
  'site.footer',
  'site.copyright',
  'site.theme_color',
  'site.icp',
  'site.police_icp',
  'site.github',
  'site.contact_email',
  'site.contact_qq',
  'site.banner',
  'site.home_notice',
  'site.default_locale',
  'site.maintenance',
  'site.maintenance_notice',
  'site.allow_register',
  'site.register_require_email',
  'site.register_require_phone',
  'site.need_email_verify',
  'site.need_phone_verify',
  'site.allow_email_login',
  'site.allow_phone_login',
  'site.registration_mode',
  'site.allow_team',
  'site.allow_team_create',
  'site.max_team_size',
  'site.min_team_size',
  'site.team_need_approval',
  'username.min_length',
  'username.max_length',
  'password.min_length',
  'challenge.show_score',
  'challenge.show_solve_count',
  'challenge.show_tags',
  'challenge.show_category',
  'challenge.allow_writeup',
  'competition.show_upcoming',
  'scoreboard.freeze_notice',
  'scoreboard.anon_visible',
  'upload.max_attachment_mb',
  'upload.max_avatar_mb',
  'upload.allowed_ext',
  'oauth.enabled',
  'points.enabled',
  'points.per_solve',
  'shop.enabled',
  'shop.title',
  'shop.notice',
  'community.moment_enabled',
  'community.moment_max_images',
  'community.moment_max_length',
  'community.discussion_enabled',
  'community.discussion_boards',
  'community.article_enabled',
  'community.article_categories',
  'community.allow_user_challenge',
  'community.allow_user_competition',
  'messages.enabled',
  'messages.allow_strangers',
  'messages.max_length',
];

/**
 * 密钥类设置：读取时打码，写入时遇到打码值就跳过。
 * 这样后台能看到「已配置」，又不会把明文回传到浏览器。
 */
const SECRET_KEYS = new Set([
  'mail.password',
  'sms.webhook_secret',
  'sms.aliyun_access_key_secret',
  'oauth.github.client_secret',
  'oauth.google.client_secret',
  'oauth.gitee.client_secret',
  'oauth.custom.client_secret',
]);

export const SECRET_MASK = '********';

export function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key);
}

const cache = new Map<string, string>();

export async function warmSettings(): Promise<void> {
  cache.clear();
  const rows = await prisma.setting.findMany();
  for (const row of rows) {
    if (row.value !== null) cache.set(row.key, row.value);
  }
}

export function getSetting(key: string): string {
  return cache.get(key) ?? SETTING_DEFAULTS[key] ?? '';
}

export function getBool(key: string): boolean {
  return getSetting(key) === 'true';
}

export function getInt(key: string): number {
  const value = Number.parseInt(getSetting(key), 10);
  return Number.isFinite(value) ? value : 0;
}

/** 带兜底值的读取：设置里为空时用 fallback（比如 .env 里的默认配置） */
export function getSettingOr(key: string, fallback: string): string {
  return getSetting(key).trim() || fallback;
}

export async function allSettings(): Promise<Record<string, string>> {
  const result: Record<string, string> = { ...SETTING_DEFAULTS };
  const rows = await prisma.setting.findMany();
  for (const row of rows) {
    if (row.value !== null) result[row.key] = row.value;
  }
  // 密钥只回传「有没有配」
  for (const key of SECRET_KEYS) {
    if (result[key]) result[key] = SECRET_MASK;
  }
  return result;
}

export function publicSettings(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of PUBLIC_KEYS) result[key] = getSetting(key);
  return result;
}

export async function updateSettings(patch: Record<string, string>): Promise<string[]> {
  const changed: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in SETTING_DEFAULTS)) continue; // 不认识的键直接忽略
    const text = value === null || value === undefined ? '' : String(value);
    // 密钥位回传打码值时说明管理员没改它，跳过
    if (SECRET_KEYS.has(key) && text === SECRET_MASK) continue;
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: text },
      update: { value: text },
    });
    cache.set(key, text);
    changed.push(key);
  }
  await cacheClear();
  return changed;
}

export async function resetSettings(keys?: string[]): Promise<void> {
  if (keys?.length) {
    await prisma.setting.deleteMany({ where: { key: { in: keys.filter((k) => k in SETTING_DEFAULTS) } } });
  } else {
    await prisma.setting.deleteMany({});
  }
  await warmSettings();
  await cacheClear();
}
