import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { optionalUser, requireAuth } from '../middleware/auth.js';
import { audit, notify } from '../lib/audit.js';
import { addPoints } from '../lib/points.js';
import { getBool, getInt, getSetting } from '../lib/settings.js';
import { rateLimit } from '../lib/redis.js';

function publicUser(user: { id: bigint; username: string; displayName: string | null; avatar: string | null }) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatar: user.avatar ?? '',
  };
}

function pageOf(query: Record<string, unknown>, defaultSize = 20, maxSize = 50) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(maxSize, Math.max(1, Number(query.size) || defaultSize));
  return { page, size, skip: (page - 1) * size };
}

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string').slice(0, 9) : [];
  } catch {
    return [];
  }
}

/** 发内容给积分，一天内同一类只给第一次，避免刷 */
async function rewardOnce(userId: bigint, kind: string, amount: number, reason: string, refId: bigint) {
  if (!getBool('points.enabled') || amount <= 0) return;
  await addPoints(userId, amount, reason, { refType: kind, refId }).catch(() => null);
}

/* ============================================================== 动态 */

export const momentRouter = Router();

momentRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const { page, size, skip } = pageOf(req.query as Record<string, unknown>);
    const username = String(req.query.username ?? '').trim();
    const mine = req.query.mine === 'true';

    const where: any = { hidden: false };
    if (username) where.user = { username };
    if (mine) {
      if (!viewer) throw ApiError.unauthorized();
      where.userId = viewer.id;
    }

    const [total, rows] = await Promise.all([
      prisma.moment.count({ where }),
      prisma.moment.findMany({
        where,
        include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
        orderBy: [{ pinned: 'desc' }, { id: 'desc' }],
        skip,
        take: size,
      }),
    ]);

    let likedIds = new Set<string>();
    if (viewer && rows.length) {
      const likes = await prisma.momentLike.findMany({
        where: { userId: viewer.id, momentId: { in: rows.map((r) => r.id) } },
        select: { momentId: true },
      });
      likedIds = new Set(likes.map((l) => String(l.momentId)));
    }

    return ok(res, {
      items: rows.map((m) => ({
        id: m.id,
        content: m.content,
        images: parseImages(m.images),
        pinned: m.pinned,
        likeCount: m.likeCount,
        commentCount: m.commentCount,
        createdAt: m.createdAt,
        user: publicUser(m.user),
        liked: likedIds.has(String(m.id)),
        isMine: viewer ? m.userId === viewer.id : false,
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

momentRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (!getBool('community.moment_enabled')) throw ApiError.forbidden('动态功能已关闭');
    if (!(await rateLimit(`moment:${user.id}`, 30))) throw ApiError.tooMany('发得太快了，歇一会儿再发');
    const body = z
      .object({
        content: z.string().trim().max(2000),
        images: z.array(z.string().max(512)).max(9).optional(),
      })
      .parse(req.body);
    if (!body.content && !body.images?.length) throw ApiError.badRequest('写点什么或者配张图吧');

    const moment = await prisma.moment.create({
      data: {
        userId: user.id,
        content: body.content.slice(0, Math.max(100, getInt('community.moment_max_length') || 2000)),
        images: JSON.stringify(body.images ?? []),
        hidden: getBool('community.moment_need_review'),
      },
    });
    await audit(req, user, 'moment.create', 'moment', moment.id);
    await rewardOnce(user.id, 'moment', getInt('points.per_moment'), '发布动态', moment.id);
    return ok(res, { id: moment.id, pending: moment.hidden }, 201);
  }),
);

momentRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const moment = await prisma.moment.findUnique({ where: { id } });
    if (!moment) throw ApiError.notFound('动态不存在');
    if (moment.userId !== user.id && user.role === 'USER') throw ApiError.forbidden();
    await prisma.moment.delete({ where: { id } });
    return ok(res, { ok: true });
  }),
);

momentRouter.post(
  '/:id/like',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const moment = await prisma.moment.findUnique({ where: { id } });
    if (!moment) throw ApiError.notFound('动态不存在');
    const existing = await prisma.momentLike.findUnique({ where: { momentId_userId: { momentId: id, userId: user.id } } });
    if (existing) {
      await prisma.$transaction([
        prisma.momentLike.delete({ where: { momentId_userId: { momentId: id, userId: user.id } } }),
        prisma.moment.update({ where: { id }, data: { likeCount: { decrement: 1 } } }),
      ]);
      return ok(res, { liked: false, likeCount: Math.max(0, moment.likeCount - 1) });
    }
    await prisma.$transaction([
      prisma.momentLike.create({ data: { momentId: id, userId: user.id } }),
      prisma.moment.update({ where: { id }, data: { likeCount: { increment: 1 } } }),
    ]);
    if (moment.userId !== user.id) {
      await notify(moment.userId, 'SYSTEM', '有人赞了你的动态', user.username, '/moments');
    }
    return ok(res, { liked: true, likeCount: moment.likeCount + 1 });
  }),
);

momentRouter.get(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const id = BigInt(req.params.id!);
    const rows = await prisma.momentComment.findMany({
      where: { momentId: id, hidden: false },
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
      orderBy: { id: 'asc' },
      take: 200,
    });
    return ok(res, {
      items: rows.map((c) => ({ id: c.id, content: c.content, createdAt: c.createdAt, user: publicUser(c.user) })),
    });
  }),
);

momentRouter.post(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const content = String(req.body?.content ?? '').trim().slice(0, 1000);
    if (!content) throw ApiError.badRequest('评论不能为空');
    const moment = await prisma.moment.findUnique({ where: { id } });
    if (!moment) throw ApiError.notFound('动态不存在');
    const comment = await prisma.momentComment.create({ data: { momentId: id, userId: user.id, content } });
    await prisma.moment.update({ where: { id }, data: { commentCount: { increment: 1 } } });
    if (moment.userId !== user.id) {
      await notify(moment.userId, 'SYSTEM', '有人评论了你的动态', content.slice(0, 60), '/moments');
    }
    return ok(res, { id: comment.id }, 201);
  }),
);

/* ============================================================== 讨论 */

export const discussionRouter = Router();

discussionRouter.get(
  '/boards',
  asyncHandler(async (_req, res) => {
    const boards = getSetting('community.discussion_boards')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const counts = await prisma.discussion.groupBy({
      by: ['board'],
      where: { hidden: false },
      _count: { _all: true },
    });
    const map = new Map(counts.map((c) => [c.board, c._count._all]));
    return ok(res, {
      items: [{ slug: 'all', name: '全部', count: counts.reduce((sum, c) => sum + c._count._all, 0) }].concat(
        boards.map((name) => ({ slug: name, name, count: map.get(name) ?? 0 })),
      ),
    });
  }),
);

discussionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, size, skip } = pageOf(req.query as Record<string, unknown>, 20);
    const board = String(req.query.board ?? '').trim();
    const keyword = String(req.query.keyword ?? '').trim();
    const where: any = { hidden: false };
    if (board && board !== 'all') where.board = board;
    if (keyword) where.title = { contains: keyword, mode: 'insensitive' };

    const [total, rows] = await Promise.all([
      prisma.discussion.count({ where }),
      prisma.discussion.findMany({
        where,
        include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
        orderBy: [{ pinned: 'desc' }, { lastReplyAt: 'desc' }, { id: 'desc' }],
        skip,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((d) => ({
        id: d.id,
        board: d.board,
        title: d.title,
        pinned: d.pinned,
        locked: d.locked,
        views: d.views,
        replyCount: d.replyCount,
        createdAt: d.createdAt,
        lastReplyAt: d.lastReplyAt ?? d.createdAt,
        user: publicUser(d.user),
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

discussionRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (!getBool('community.discussion_enabled')) throw ApiError.forbidden('讨论区已关闭');
    if (!(await rateLimit(`discussion:${user.id}`, 60))) throw ApiError.tooMany('发帖太频繁了');
    const body = z
      .object({
        title: z.string().trim().min(2, '标题太短').max(200),
        content: z.string().trim().min(1, '内容不能为空').max(50000),
        board: z.string().trim().max(32).optional(),
      })
      .parse(req.body);
    const discussion = await prisma.discussion.create({
      data: { title: body.title, content: body.content, board: body.board || '综合讨论', userId: user.id },
    });
    await audit(req, user, 'discussion.create', 'discussion', discussion.id, body.title);
    await rewardOnce(user.id, 'discussion', getInt('points.per_discussion'), '发布讨论', discussion.id);
    return ok(res, { id: discussion.id }, 201);
  }),
);

discussionRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = BigInt(req.params.id!);
    const discussion = await prisma.discussion.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
    });
    if (!discussion || discussion.hidden) throw ApiError.notFound('帖子不存在');
    await prisma.discussion.update({ where: { id }, data: { views: { increment: 1 } } });
    const replies = await prisma.discussionReply.findMany({
      where: { discussionId: id, hidden: false },
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
      orderBy: { id: 'asc' },
      take: 500,
    });
    return ok(res, {
      id: discussion.id,
      board: discussion.board,
      title: discussion.title,
      content: discussion.content,
      pinned: discussion.pinned,
      locked: discussion.locked,
      views: discussion.views + 1,
      createdAt: discussion.createdAt,
      user: publicUser(discussion.user),
      replies: replies.map((r) => ({
        id: r.id,
        floor: r.floor,
        content: r.content,
        createdAt: r.createdAt,
        user: publicUser(r.user),
      })),
    });
  }),
);

discussionRouter.post(
  '/:id/replies',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const content = String(req.body?.content ?? '').trim().slice(0, 20000);
    if (!content) throw ApiError.badRequest('回复不能为空');
    const discussion = await prisma.discussion.findUnique({ where: { id } });
    if (!discussion || discussion.hidden) throw ApiError.notFound('帖子不存在');
    if (discussion.locked && user.role === 'USER') throw ApiError.forbidden('该帖已锁定，无法回复');
    const floor = discussion.replyCount + 1;
    const reply = await prisma.discussionReply.create({ data: { discussionId: id, userId: user.id, content, floor } });
    await prisma.discussion.update({
      where: { id },
      data: { replyCount: { increment: 1 }, lastReplyAt: new Date() },
    });
    if (discussion.userId !== user.id) {
      await notify(discussion.userId, 'SYSTEM', `你的帖子有新回复`, discussion.title, `/discussions/${id}`);
    }
    return ok(res, { id: reply.id, floor }, 201);
  }),
);

discussionRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const discussion = await prisma.discussion.findUnique({ where: { id } });
    if (!discussion) throw ApiError.notFound('帖子不存在');
    if (discussion.userId !== user.id && user.role === 'USER') throw ApiError.forbidden();
    await prisma.discussion.delete({ where: { id } });
    return ok(res, { ok: true });
  }),
);

/* ========================================================== 文章广场 */

export const articleRouter = Router();

articleRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const list = getSetting('community.article_categories')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const counts = await prisma.article.groupBy({
      by: ['category'],
      where: { hidden: false, state: 'APPROVED' },
      _count: { _all: true },
    });
    const map = new Map(counts.map((c) => [c.category, c._count._all]));
    return ok(res, {
      items: [{ slug: 'all', name: '全部', count: counts.reduce((s, c) => s + c._count._all, 0) }].concat(
        list.map((name) => ({ slug: name, name, count: map.get(name) ?? 0 })),
      ),
    });
  }),
);

articleRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const { page, size, skip } = pageOf(req.query as Record<string, unknown>, 12, 40);
    const category = String(req.query.category ?? '').trim();
    const keyword = String(req.query.keyword ?? '').trim();
    const mine = req.query.mine === 'true';

    const where: any = {};
    if (mine) {
      if (!viewer) throw ApiError.unauthorized();
      where.userId = viewer.id;
    } else {
      where.hidden = false;
      where.state = 'APPROVED';
    }
    if (category && category !== 'all') where.category = category;
    if (keyword) where.OR = [{ title: { contains: keyword, mode: 'insensitive' } }, { summary: { contains: keyword, mode: 'insensitive' } }];

    const [total, rows] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
        orderBy: [{ pinned: 'desc' }, { id: 'desc' }],
        skip,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((a) => ({
        id: a.id,
        title: a.title,
        summary: a.summary,
        cover: a.cover ?? '',
        category: a.category,
        state: a.state,
        pinned: a.pinned,
        views: a.views,
        likeCount: a.likeCount,
        createdAt: a.createdAt,
        user: publicUser(a.user),
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

articleRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (!getBool('community.article_enabled')) throw ApiError.forbidden('文章功能已关闭');
    if (!(await rateLimit(`article:${user.id}`, 60))) throw ApiError.tooMany('发布太频繁了');
    const body = z
      .object({
        title: z.string().trim().min(2, '标题太短').max(200),
        content: z.string().trim().min(1, '内容不能为空').max(200000),
        summary: z.string().trim().max(500).optional(),
        cover: z.string().trim().max(512).optional(),
        category: z.string().trim().max(32).optional(),
      })
      .parse(req.body);
    const pending = getBool('community.article_need_review') && user.role === 'USER';
    const article = await prisma.article.create({
      data: {
        title: body.title,
        content: body.content,
        summary: body.summary || body.content.replace(/[#*`>\-\s]/g, '').slice(0, 160),
        cover: body.cover || null,
        category: body.category || '综合',
        userId: user.id,
        state: pending ? 'PENDING' : 'APPROVED',
      },
    });
    await audit(req, user, 'article.create', 'article', article.id, body.title);
    await rewardOnce(user.id, 'article', getInt('points.per_article'), '发布文章', article.id);
    return ok(res, { id: article.id, pending }, 201);
  }),
);

articleRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const id = BigInt(req.params.id!);
    const article = await prisma.article.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
    });
    if (!article) throw ApiError.notFound('文章不存在');
    const isOwner = viewer?.id === article.userId;
    const isStaff = Boolean(viewer && viewer.role !== 'USER');
    if ((article.hidden || article.state !== 'APPROVED') && !isOwner && !isStaff) throw ApiError.notFound('文章不存在');
    await prisma.article.update({ where: { id }, data: { views: { increment: 1 } } });
    const comments = await prisma.articleComment.findMany({
      where: { articleId: id, hidden: false },
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
      orderBy: { id: 'asc' },
      take: 200,
    });
    return ok(res, {
      id: article.id,
      title: article.title,
      summary: article.summary,
      content: article.content,
      cover: article.cover ?? '',
      category: article.category,
      state: article.state,
      views: article.views + 1,
      likeCount: article.likeCount,
      createdAt: article.createdAt,
      user: publicUser(article.user),
      isMine: isOwner,
      comments: comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        user: publicUser(c.user),
      })),
    });
  }),
);

articleRouter.post(
  '/:id/like',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const article = await prisma.article.update({ where: { id }, data: { likeCount: { increment: 1 } } });
    if (article.userId !== user.id) {
      await notify(article.userId, 'SYSTEM', '有人赞了你的文章', article.title, `/articles/${id}`);
    }
    return ok(res, { likeCount: article.likeCount });
  }),
);

articleRouter.post(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const content = String(req.body?.content ?? '').trim().slice(0, 1000);
    if (!content) throw ApiError.badRequest('评论不能为空');
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) throw ApiError.notFound('文章不存在');
    const comment = await prisma.articleComment.create({ data: { articleId: id, userId: user.id, content } });
    if (article.userId !== user.id) {
      await notify(article.userId, 'SYSTEM', '有人评论了你的文章', content.slice(0, 60), `/articles/${id}`);
    }
    return ok(res, { id: comment.id }, 201);
  }),
);

articleRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) throw ApiError.notFound('文章不存在');
    if (article.userId !== user.id && user.role === 'USER') throw ApiError.forbidden();
    await prisma.article.delete({ where: { id } });
    return ok(res, { ok: true });
  }),
);
