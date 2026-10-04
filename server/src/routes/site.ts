import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, ok } from '../lib/errors.js';
import { publicSettings } from '../lib/settings.js';

export const siteRouter = Router();

/** 前端首屏需要的公开数据：站点设置、分类、公告、统计 */
siteRouter.get(
  '/meta',
  asyncHandler(async (_req, res) => {
    const [categories, announcements] = await Promise.all([
      prisma.category.findMany({ where: { visible: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
      prisma.announcement.findMany({ where: { visible: true }, orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }], take: 10 }),
    ]);
    return ok(res, { settings: publicSettings(), categories, announcements });
  }),
);

siteRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => ok(res, publicSettings())),
);

/** 公告列表：前台「公告」页用，只返回可见的 */
siteRouter.get(
  '/announcements',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(50, Math.max(1, Number(req.query.size) || 20));
    const [total, rows] = await Promise.all([
      prisma.announcement.count({ where: { visible: true } }),
      prisma.announcement.findMany({
        where: { visible: true },
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        level: a.level,
        pinned: a.pinned,
        publishedAt: a.publishedAt,
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

siteRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [users, challenges, solves, competitions] = await Promise.all([
      prisma.user.count({ where: { hidden: false, banned: false } }),
      prisma.challenge.count({ where: { state: 'VISIBLE' } }),
      prisma.solve.count(),
      prisma.competition.count({ where: { published: true } }),
    ]);
    return ok(res, { users, challenges, solves, competitions });
  }),
);

siteRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    let db = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    return ok(res, { status: db ? 'UP' : 'DOWN', database: db, time: new Date().toISOString() });
  }),
);
