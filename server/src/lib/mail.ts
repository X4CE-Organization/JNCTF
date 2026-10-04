import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';
import { logger } from './logger.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!config.mail.enabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.port === 465,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
      tls: config.mail.tls ? { rejectUnauthorized: false } : undefined,
    });
  }
  return transporter;
}

/** 发邮件。没配 SMTP 时只写日志，不抛异常。 */
export async function sendMail(to: string | null | undefined, subject: string, body: string): Promise<void> {
  if (!to) return;
  const tx = getTransporter();
  if (!tx) {
    logger.info({ to, subject }, '[邮件未启用] 内容已跳过发送');
    return;
  }
  try {
    await tx.sendMail({ from: config.mail.from, to, subject, text: body });
  } catch (err) {
    logger.warn({ err, to }, '发送邮件失败');
  }
}
