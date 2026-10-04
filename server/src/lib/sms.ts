import crypto from 'node:crypto';
import { getBool, getSetting } from './settings.js';
import { logger } from './logger.js';

/**
 * 短信通道。目前支持：
 * - none    不真发，只写日志；开发时配合 `sms.debug_return_code` 直接把验证码回给前端
 * - webhook 把 {phone, code, signName, template} POST 到你自己的网关（通用，什么服务商都能接）
 * - aliyun  阿里云短信（SendSms，RPC 签名）
 */
export interface SmsResult {
  ok: boolean;
  skipped?: boolean;
  /** 仅调试模式（provider=none + debug_return_code）才有值 */
  debugCode?: string;
  error?: string;
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~');
}

async function sendViaWebhook(phone: string, code: string): Promise<SmsResult> {
  const url = getSetting('sms.webhook_url').trim();
  if (!url) return { ok: false, error: '未填写 Webhook 地址' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getSetting('sms.webhook_secret') ? { 'X-JNCTF-Signature': getSetting('sms.webhook_secret') } : {}),
      },
      body: JSON.stringify({
        phone,
        code,
        signName: getSetting('sms.sign_name'),
        template: getSetting('sms.template_code'),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `Webhook 返回 ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendViaAliyun(phone: string, code: string): Promise<SmsResult> {
  const keyId = getSetting('sms.aliyun_access_key_id').trim();
  const keySecret = getSetting('sms.aliyun_access_key_secret').trim();
  const signName = getSetting('sms.sign_name').trim();
  const templateCode = getSetting('sms.template_code').trim();
  if (!keyId || !keySecret) return { ok: false, error: '未填写阿里云 AccessKey' };
  if (!signName || !templateCode) return { ok: false, error: '未填写短信签名或模板' };

  const params: Record<string, string> = {
    AccessKeyId: keyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: phone,
    RegionId: getSetting('sms.aliyun_region') || 'cn-hangzhou',
    SignName: signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: '1.0',
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  };
  const canonical = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k]!)}`)
    .join('&');
  const stringToSign = `GET&%2F&${percentEncode(canonical)}`;
  const signature = crypto.createHmac('sha1', `${keySecret}&`).update(stringToSign).digest('base64');
  const query = `${canonical}&Signature=${percentEncode(signature)}`;

  try {
    const res = await fetch(`https://dysmsapi.aliyuncs.com/?${query}`, { signal: AbortSignal.timeout(10_000) });
    const data: any = await res.json().catch(() => null);
    if (data?.Code === 'OK') return { ok: true };
    return { ok: false, error: data?.Message || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendSms(phone: string, code: string): Promise<SmsResult> {
  if (!getBool('sms.enabled')) {
    logger.info({ phone }, '[短信未启用] 验证码已跳过发送');
    return { ok: false, skipped: true, error: '短信功能未启用' };
  }
  const provider = getSetting('sms.provider') || 'none';
  if (provider === 'none') {
    const debug = getBool('sms.debug_return_code');
    logger.info({ phone, code: debug ? code : '******' }, '[短信通道为 none] 验证码已跳过发送');
    return debug ? { ok: true, debugCode: code } : { ok: false, skipped: true, error: '未配置短信服务商' };
  }
  if (provider === 'webhook') return sendViaWebhook(phone, code);
  if (provider === 'aliyun') return sendViaAliyun(phone, code);
  return { ok: false, error: `未知的短信服务商：${provider}` };
}

/** 后台「发送测试短信」用 */
export async function sendTestSms(phone: string, code: string): Promise<SmsResult> {
  return sendSms(phone, code);
}
