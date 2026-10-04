import crypto from 'node:crypto';
import { getInt } from './settings.js';
import { redis } from './redis.js';

/**
 * 邮箱 / 手机验证码。正常走 Redis，Redis 没连上时退化成进程内内存，
 * 单机自建场景不会因为没装 Redis 就不能注册。
 */
export type CodeChannel = 'email' | 'phone';
export type CodeScene = 'register' | 'login' | 'bind' | 'reset';

const memory = new Map<string, { value: string; expiresAt: number }>();

function codeKey(channel: CodeChannel, scene: CodeScene, target: string): string {
  return `jnctf:code:${channel}:${scene}:${target.toLowerCase()}`;
}

function rateKey(channel: CodeChannel, target: string): string {
  return `jnctf:code:rl:${channel}:${target.toLowerCase()}`;
}

function dayKey(channel: CodeChannel, target: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `jnctf:code:day:${channel}:${target.toLowerCase()}:${day}`;
}

function memSweep() {
  const now = Date.now();
  for (const [key, item] of memory) if (item.expiresAt <= now) memory.delete(key);
}

export function generateCode(length = 6): string {
  let out = '';
  while (out.length < length) out += crypto.randomInt(0, 10).toString();
  return out;
}

export interface IssueResult {
  ok: boolean;
  code?: string;
  reason?: string;
  retryAfter?: number;
}

/** 生成验证码并写入存储，同时做「重发间隔」和「每日上限」限制 */
export async function issueCode(channel: CodeChannel, scene: CodeScene, target: string): Promise<IssueResult> {
  const ttl = Math.max(60, getInt('security.code_ttl_seconds') || 300);
  const interval = Math.max(0, getInt('security.code_resend_seconds') || 60);
  const dailyCap = Math.max(0, getInt('security.code_max_per_day') || 10);
  memSweep();

  if (redis.status === 'ready') {
    if (interval > 0) {
      const allowed = await redis.set(rateKey(channel, target), '1', 'EX', interval, 'NX').catch(() => 'OK');
      if (allowed !== 'OK') return { ok: false, reason: '请求过于频繁，请稍后再试', retryAfter: interval };
    }
    if (dailyCap > 0) {
      const used = await redis.incr(dayKey(channel, target)).catch(() => 0);
      if (used === 1) await redis.expire(dayKey(channel, target), 86_400).catch(() => 0);
      if (used > dailyCap) return { ok: false, reason: '今日验证码发送次数已达上限' };
    }
  } else {
    const rk = rateKey(channel, target);
    const now = Date.now();
    const recent = memory.get(rk);
    if (interval > 0 && recent && recent.expiresAt > now) {
      return { ok: false, reason: '请求过于频繁，请稍后再试', retryAfter: Math.ceil((recent.expiresAt - now) / 1000) };
    }
    memory.set(rk, { value: '1', expiresAt: now + interval * 1000 });
    const dk = dayKey(channel, target);
    const used = Number.parseInt(memory.get(dk)?.value ?? '0', 10) + 1;
    memory.set(dk, { value: String(used), expiresAt: now + 86_400_000 });
    if (dailyCap > 0 && used > dailyCap) return { ok: false, reason: '今日验证码发送次数已达上限' };
  }

  const code = generateCode(6);
  if (redis.status === 'ready') {
    await redis.set(codeKey(channel, scene, target), code, 'EX', ttl).catch(() => null);
  } else {
    memory.set(codeKey(channel, scene, target), { value: code, expiresAt: Date.now() + ttl * 1000 });
  }
  return { ok: true, code };
}

/** 校验并消费验证码，成功即作废 */
export async function consumeCode(channel: CodeChannel, scene: CodeScene, target: string, code: string): Promise<boolean> {
  if (!code) return false;
  const key = codeKey(channel, scene, target);
  memSweep();
  if (redis.status === 'ready') {
    const saved = await redis.get(key).catch(() => null);
    if (!saved || saved !== code.trim()) return false;
    await redis.del(key).catch(() => 0);
    return true;
  }
  const saved = memory.get(key);
  if (!saved || saved.expiresAt <= Date.now() || saved.value !== code.trim()) return false;
  memory.delete(key);
  return true;
}

/** 不改动存储，只判断对不对（给「先校验再下一步」的场景用） */
export async function peekCode(channel: CodeChannel, scene: CodeScene, target: string, code: string): Promise<boolean> {
  if (!code) return false;
  const key = codeKey(channel, scene, target);
  memSweep();
  if (redis.status === 'ready') {
    const saved = await redis.get(key).catch(() => null);
    return Boolean(saved) && saved === code.trim();
  }
  const saved = memory.get(key);
  if (!saved) return false;
  return saved.expiresAt > Date.now() && saved.value === code.trim();
}
