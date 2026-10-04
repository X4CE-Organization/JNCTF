import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';
import { getBool, getSetting, getSettingOr } from './settings.js';
import { logger } from './logger.js';

/**
 * SMTP 配置优先读「后台 → 系统设置 → 邮件」，留空时回落到 .env。
 * 这样不改配置文件也能在后台把邮件配起来。
 */
export interface MailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  tlsInsecure: boolean;
}

export function mailConfig(): MailConfig {
  const port = Number.parseInt(getSetting('mail.port'), 10) || config.mail.port;
  const fromAddress = getSettingOr('mail.from', config.mail.from);
  const fromName = getSetting('mail.from_name').trim();
  return {
    enabled: getBool('mail.enabled'),
    host: getSettingOr('mail.host', config.mail.host),
    port,
    secure: getBool('mail.secure') || port === 465,
    user: getSettingOr('mail.username', config.mail.user),
    pass: getSettingOr('mail.password', config.mail.pass),
    from: fromName && !fromAddress.includes('<') ? `${fromName} <${fromAddress}>` : fromAddress,
    tlsInsecure: getBool('mail.tls_insecure'),
  };
}

let cached: { key: string; tx: Transporter } | null = null;

function transporter(cfg: MailConfig): Transporter {
  // 配置变了就重建，后台改完立刻生效
  const key = JSON.stringify([cfg.host, cfg.port, cfg.secure, cfg.user, cfg.pass, cfg.tlsInsecure]);
  if (cached?.key === key) return cached.tx;
  const tx = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    tls: cfg.tlsInsecure ? { rejectUnauthorized: false } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  cached = { key, tx };
  return tx;
}

export interface MailResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * 发邮件。没配 SMTP 时只写日志，不抛异常（注册、找回密码等流程不该被邮件拖死）。
 */
export async function sendMailDetailed(to: string | null | undefined, subject: string, body: string): Promise<MailResult> {
  if (!to) return { ok: false, error: '收件人为空' };
  const cfg = mailConfig();
  if (!cfg.enabled) {
    logger.info({ to, subject }, '[邮件未启用] 内容已跳过发送');
    return { ok: false, skipped: true, error: '邮件未启用' };
  }
  try {
    const info = await transporter(cfg).sendMail({ from: cfg.from, to, subject, text: body });
    if (getBool('mail.debug')) logger.info({ to, subject, messageId: info.messageId }, '邮件已发送');
    return { ok: true };
  } catch (err) {
    logger.warn({ err, to }, '发送邮件失败');
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendMail(to: string | null | undefined, subject: string, body: string): Promise<void> {
  await sendMailDetailed(to, subject, body);
}

/** 后台「发送测试邮件」用，返回 SMTP 的真实回执或报错 */
export async function verifyMailConnection(): Promise<MailResult> {
  const cfg = mailConfig();
  if (!cfg.enabled) return { ok: false, skipped: true, error: '邮件功能未启用' };
  try {
    await transporter(cfg).verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
