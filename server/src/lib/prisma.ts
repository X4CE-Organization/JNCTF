import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

/**
 * 全局 Prisma 实例。
 * BigInt 默认不能 JSON 序列化，这里统一挂一个 toJSON，
 * 前端拿到的 id 就是普通数字，不用到处手动转换。
 */
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function toJSON(this: bigint) {
  const value = Number(this);
  return Number.isSafeInteger(value) ? value : Number(this.toString());
};

export const prisma = new PrismaClient({
  log: config.isProd ? ['warn', 'error'] : ['warn', 'error'],
});

/** 把 BigInt 字段统一转成 number，避免响应里出现 "1n" 这种没法解析的东西 */
export function plain<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? Number(item) : item)),
  ) as T;
}
