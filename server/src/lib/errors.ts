import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger.js';

/** 业务异常：抛它就会返回对应状态码和错误码 */
export class ApiError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(status: number, code: string, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }

  static badRequest(message: string, detail?: unknown) {
    return new ApiError(400, 'BAD_REQUEST', message, detail);
  }
  static unauthorized(message = '请先登录') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = '没有权限执行该操作') {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  static notFound(message = '资源不存在') {
    return new ApiError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string) {
    return new ApiError(409, 'CONFLICT', message);
  }
  static tooMany(message = '操作过于频繁，请稍后再试') {
    return new ApiError(429, 'TOO_MANY_REQUESTS', message);
  }
}

/** 统一成功响应 */
export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({
    success: true,
    data: data === undefined ? null : JSON.parse(JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))),
    timestamp: new Date().toISOString(),
  });
}

/** 全局错误处理，必须放在所有路由之后 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, detail: err.detail },
      timestamp: new Date().toISOString(),
    });
  }
  if (err instanceof ZodError) {
    const message = err.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('；');
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_FAILED', message: message || '请求参数不正确', detail: err.issues },
      timestamp: new Date().toISOString(),
    });
  }
  const anyErr = err as { type?: string; message?: string };
  if (anyErr?.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: '请求体不是合法的 JSON' },
      timestamp: new Date().toISOString(),
    });
  }
  logger.error({ err }, '未处理异常');
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: '服务器开小差了，请稍后再试' },
    timestamp: new Date().toISOString(),
  });
}

/** 包一层 async 路由，省掉每个 handler 里的 try/catch */
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(
  handler: T,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
