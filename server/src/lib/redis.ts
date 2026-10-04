import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from './logger.js';

/**
 * Redis 用来做：分布式限流、找回密码令牌、比赛实时榜缓存、在线人数。
 * 连不上时全部降级为「放行」，不影响主流程。
 */
export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
});

redis.on('error', (err) => {
  if (redis.status !== 'ready') return;
  logger.warn({ err: err.message }, 'Redis 连接异常');
});

export async function initRedis(): Promise<void> {
  try {
    await redis.connect();
    logger.info('Redis 已连接');
  } catch {
    logger.warn('Redis 未连接，限流与缓存降级为内存模式');
  }
}

/** 简单的「interval 秒内只允许一次」限流，返回 true 表示放行 */
export async function rateLimit(key: string, seconds: number): Promise<boolean> {
  if (seconds <= 0 || redis.status !== 'ready') return true;
  try {
    const result = await redis.set(`jnctf:rl:${key}`, '1', 'EX', seconds, 'NX');
    return result === 'OK';
  } catch {
    return true;
  }
}

/**
 * 失败计数器：每次调用 +1，返回当前失败次数；超过 ttl 自动清零。
 * 登录锁定用这个，而不是 rateLimit —— 限流是「多久只能来一次」，
 * 登录要的是「失败几次才锁」，语义不一样。
 */
export async function increaseFailure(key: string, ttlSeconds: number): Promise<number> {
  if (redis.status !== 'ready') return 0;
  try {
    const full = `jnctf:fail:${key}`;
    const count = await redis.incr(full);
    if (count === 1) await redis.expire(full, Math.max(1, ttlSeconds));
    return count;
  } catch {
    return 0;
  }
}

export async function readFailure(key: string): Promise<number> {
  if (redis.status !== 'ready') return 0;
  try {
    const value = await redis.get(`jnctf:fail:${key}`);
    return value ? Number.parseInt(value, 10) : 0;
  } catch {
    return 0;
  }
}

export async function clearFailure(key: string): Promise<void> {
  if (redis.status !== 'ready') return;
  try {
    await redis.del(`jnctf:fail:${key}`);
  } catch {
    /* 忽略 */
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (redis.status !== 'ready' || ttlSeconds <= 0) return;
  try {
    await redis.set(`jnctf:cache:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    /* 忽略 */
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redis.status !== 'ready') return null;
  try {
    const raw = await redis.get(`jnctf:cache:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheClear(prefix = ''): Promise<number> {
  if (redis.status !== 'ready') return 0;
  try {
    const keys = await redis.keys(`jnctf:cache:${prefix}*`);
    if (!keys.length) return 0;
    return redis.del(...keys);
  } catch {
    return 0;
  }
}
