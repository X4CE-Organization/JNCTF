import { prisma } from './prisma.js';
import { cacheClear } from './redis.js';

/**
 * 站点设置。所有可调项在这里声明一次：key -> 默认值。
 * 数据库里没有记录就走默认值，所以升级不会因为缺项报错。
 */
export const SETTING_DEFAULTS: Record<string, string> = {
  'site.name': 'JNCTF',
  'site.description': '一个开源的 CTF 竞赛平台',
  'site.logo': '',
  'site.favicon': '',
  'site.footer': 'Powered by JNCTF',
  'site.theme_color': '#6366f1',
  'site.icp': '',
  'site.github': 'https://github.com/x4ce-organization/JNCTF',
  'site.contact_email': '',
  'site.banner': '',

  'site.allow_register': 'true',
  // none / email —— 注册方式
  'site.registration_mode': 'none',
  'site.need_email_verify': 'false',
  'site.allow_team': 'true',
  'site.max_team_size': '4',
  'site.default_locale': 'zh-CN',

  'challenge.show_score': 'true',
  'challenge.show_solve_count': 'true',
  'challenge.show_tags': 'true',
  'challenge.submit_interval_seconds': '5',

  'competition.show_upcoming': 'true',
  'scoreboard.freeze_notice': '比赛最后 30 分钟封榜，最终排名以结算为准',

  'security.login_fail_limit': '10',
  'security.login_lock_minutes': '15',
  'security.allow_api_token': 'true',

  'upload.max_attachment_mb': '100',
  'upload.max_avatar_mb': '4',

  'docker.enabled': 'false',
  'docker.instance_ttl_minutes': '60',
  'docker.max_instance_per_user': '2',
};

/** 对游客公开的设置项 */
export const PUBLIC_KEYS = [
  'site.name',
  'site.description',
  'site.logo',
  'site.favicon',
  'site.footer',
  'site.theme_color',
  'site.icp',
  'site.github',
  'site.contact_email',
  'site.banner',
  'site.allow_register',
  'site.registration_mode',
  'site.need_email_verify',
  'site.allow_team',
  'site.max_team_size',
  'challenge.show_score',
  'challenge.show_solve_count',
  'challenge.show_tags',
  'competition.show_upcoming',
  'scoreboard.freeze_notice',
];

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

export async function allSettings(): Promise<Record<string, string>> {
  const result: Record<string, string> = { ...SETTING_DEFAULTS };
  const rows = await prisma.setting.findMany();
  for (const row of rows) {
    if (row.value !== null) result[row.key] = row.value;
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
