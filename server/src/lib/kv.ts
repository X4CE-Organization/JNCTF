import { redis } from './redis.js';

/**
 * 一次性小数据的存放（OAuth state / 一次性票据之类）。
 * Redis 可用就用 Redis，不可用退化成进程内内存——自建单机不会因为没装 Redis 而登录不了。
 */
interface Entry {
  value: string;
  expiresAt: number;
}

const memory = new Map<string, Entry>();

function sweep() {
  const now = Date.now();
  for (const [key, entry] of memory) if (entry.expiresAt <= now) memory.delete(key);
}

export async function kvSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const text = JSON.stringify(value);
  if (redis.status === 'ready') {
    await redis.set(key, text, 'EX', Math.max(1, ttlSeconds)).catch(() => null);
    return;
  }
  sweep();
  memory.set(key, { value: text, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (redis.status === 'ready') {
    const raw = await redis.get(key).catch(() => null);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  sweep();
  const entry = memory.get(key);
  if (!entry) return null;
  try {
    return JSON.parse(entry.value) as T;
  } catch {
    return null;
  }
}

/** 取一次就删掉（一次性票据） */
export async function kvTake<T>(key: string): Promise<T | null> {
  const value = await kvGet<T>(key);
  await kvDel(key);
  return value;
}

export async function kvDel(key: string): Promise<void> {
  if (redis.status === 'ready') {
    await redis.del(key).catch(() => 0);
    return;
  }
  memory.delete(key);
}
