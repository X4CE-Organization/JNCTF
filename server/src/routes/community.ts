import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { optionalUser, requireAuth } from '../middleware/auth.js';
import { audit, notify } from '../lib/audit.js';
import { rateLimit } from '../lib/redis.js';

/* ============================================================== 题解 */

export const writeupRouter = Router();

writeupRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(50, Math.max(1, Number(req.query.size) || 20));
    const challengeId = req.query.challengeId ? BigInt(String(req.query.challengeId)) : undefined;
    const rows = await prisma.writeup.findMany({
      where: {
        state: 'APPROVED',
        ...(challengeId ? { challengeId } : {}),
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
        challenge: { select: { id: true, title: true } },
      },
      orderBy: { id: 'desc' },
      skip: (page - 1) * size,
      take: size,
    });
    const total = await prisma.writeup.count({ where: { state: 'APPROVED', ...(challengeId ? { challengeId } : {}) } });
    return ok(res, {
      items: rows.map((w) => ({
        id: w.id,
        title: w.title,
        url: w.url,
        likes: w.likes,
        views: w.views,
        createdAt: w.createdAt,
        author: { id: w.user.id, username: w.user.username, displayName: w.user.displayName || w.user.username, avatar: w.user.avatar },
        challenge: { id: w.challenge.id, title: w.challenge.title },
        isMine: viewer ? w.userId === viewer.id : false,
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

writeupRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const id = BigInt(req.params.id!);
    const writeup = await prisma.writeup.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
        challenge: { select: { id: true, title: true, allowWriteup: true } },
      },
    });
    if (!writeup) throw ApiError.notFound('题解不存在');
    const isOwner = viewer?.id === writeup.userId;
    const isStaff = Boolean(viewer && viewer.role !== 'USER');
    if (writeup.state !== 'APPROVED' && !isOwner && !isStaff) throw ApiError.notFound('题解不存在');
    if (!writeup.challenge.allowWriteup && !isStaff) throw ApiError.forbidden('该题不允许发布题解');
    await prisma.writeup.update({ where: { id }, data: { views: { increment: 1 } } });
    return ok(res, {
      id: writeup.id,
      title: writeup.title,
      content: writeup.content ?? '',
      url: writeup.url ?? '',
      state: writeup.state,
      likes: writeup.likes,
      views: writeup.views + 1,
      createdAt: writeup.createdAt,
      author: { id: writeup.user.id, username: writeup.user.username, displayName: writeup.user.displayName || writeup.user.username, avatar: writeup.user.avatar },
      challenge: { id: writeup.challenge.id, title: writeup.challenge.title },
      isMine: isOwner,
    });
  }),
);

writeupRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const body = z
      .object({
        challengeId: z.union([z.string(), z.number()]),
        title: z.string().trim().min(2).max(200),
        content: z.string().max(100000).optional(),
        url: z.string().max(512).optional(),
      })
      .parse(req.body);
    const challengeId = BigInt(body.challengeId);
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw ApiError.notFound('题目不存在');
    if (!challenge.allowWriteup) throw ApiError.forbidden('该题不允许发布题解');
    const solved = await prisma.solve.findFirst({ where: { challengeId, userId: user.id } });
    if (!solved && user.role === 'USER') throw ApiError.forbidden('解出题目后才能发布题解');

    const writeup = await prisma.writeup.create({
      data: { challengeId, userId: user.id, title: body.title, content: body.content ?? null, url: body.url ?? null },
    });
    await audit(req, user, 'writeup.create', 'writeup', writeup.id, body.title);
    return ok(res, { id: writeup.id, state: writeup.state }, 201);
  }),
);

writeupRouter.post(
  '/:id/like',
  asyncHandler(async (req, res) => {
    const id = BigInt(req.params.id!);
    const writeup = await prisma.writeup.update({ where: { id }, data: { likes: { increment: 1 } } });
    return ok(res, { likes: writeup.likes });
  }),
);

writeupRouter.get(
  '/mine/list',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const rows = await prisma.writeup.findMany({
      where: { userId: user.id },
      include: { challenge: { select: { id: true, title: true } } },
      orderBy: { id: 'desc' },
    });
    return ok(res, { items: rows });
  }),
);

writeupRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const writeup = await prisma.writeup.findUnique({ where: { id } });
    if (!writeup) throw ApiError.notFound('题解不存在');
    if (writeup.userId !== user.id && user.role === 'USER') throw ApiError.forbidden();
    await prisma.writeup.delete({ where: { id } });
    return ok(res, { ok: true });
  }),
);

/* ============================================================== 工单 */

export const ticketRouter = Router();

ticketRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const rows = await prisma.ticket.findMany({
      where: { userId: user.id },
      include: { _count: { select: { messages: true } } },
      orderBy: { id: 'desc' },
    });
    return ok(res, {
      items: rows.map((t) => ({
        id: t.id,
        subject: t.subject,
        category: t.category,
        priority: t.priority,
        status: t.status,
        messageCount: t._count.messages,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  }),
);

ticketRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (!(await rateLimit(`ticket:${user.id}`, 60))) throw ApiError.tooMany('提交过于频繁，请稍后再试');
    const body = z
      .object({
        subject: z.string().trim().min(2).max(200),
        category: z.string().max(32).optional(),
        priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
        content: z.string().trim().min(2).max(5000),
        refType: z.string().max(32).optional(),
        refId: z.union([z.string(), z.number()]).optional(),
      })
      .parse(req.body);
    const ticket = await prisma.ticket.create({
      data: {
        subject: body.subject,
        category: body.category ?? 'OTHER',
        priority: body.priority ?? 'NORMAL',
        userId: user.id,
        refType: body.refType ?? null,
        refId: body.refId ? BigInt(body.refId) : null,
        lastReplyAt: new Date(),
        messages: { create: { userId: user.id, content: body.content } },
      },
    });
    await audit(req, user, 'ticket.create', 'ticket', ticket.id, body.subject);
    return ok(res, { id: ticket.id }, 201);
  }),
);

ticketRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
        assignee: { select: { id: true, username: true, displayName: true } },
        messages: { include: { user: { select: { id: true, username: true, displayName: true, avatar: true, role: true } } }, orderBy: { id: 'asc' } },
      },
    });
    if (!ticket) throw ApiError.notFound('工单不存在');
    const isStaff = user.role !== 'USER';
    if (ticket.userId !== user.id && !isStaff) throw ApiError.forbidden('无权查看该工单');
    return ok(res, {
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      user: ticket.user,
      assignee: ticket.assignee,
      // 内部备注只给管理员看
      messages: ticket.messages
        .filter((m) => !m.internal || isStaff)
        .map((m) => ({
          id: m.id,
          content: m.content,
          internal: m.internal,
          createdAt: m.createdAt,
          user: { id: m.user.id, username: m.user.username, displayName: m.user.displayName || m.user.username, avatar: m.user.avatar, isStaff: m.user.role !== 'USER' },
        })),
    });
  }),
);

ticketRouter.post(
  '/:id/reply',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const content = String(req.body?.content ?? '').trim();
    if (!content) throw ApiError.badRequest('回复内容不能为空');
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw ApiError.notFound('工单不存在');
    const isStaff = user.role !== 'USER';
    if (ticket.userId !== user.id && !isStaff) throw ApiError.forbidden('无权回复该工单');
    if (ticket.status === 'CLOSED') throw ApiError.badRequest('工单已关闭');

    const internal = isStaff && req.body?.internal === true;
    await prisma.$transaction([
      prisma.ticketMessage.create({ data: { ticketId: id, userId: user.id, content: content.slice(0, 5000), internal } }),
      prisma.ticket.update({
        where: { id },
        data: { lastReplyAt: new Date(), status: isStaff && ticket.status === 'OPEN' ? 'PENDING' : ticket.status },
      }),
    ]);
    // 内部备注不通知用户
    if (!internal) {
      if (isStaff && ticket.userId !== user.id) {
        await notify(ticket.userId, 'TICKET', `工单「${ticket.subject}」有新的回复`, content.slice(0, 200), `/tickets/${id}`);
      } else if (ticket.assigneeId) {
        await notify(ticket.assigneeId, 'TICKET', `工单「${ticket.subject}」有新的回复`, content.slice(0, 200), `/admin/tickets`);
      }
    }
    return ok(res, { ok: true });
  }),
);

ticketRouter.post(
  '/:id/close',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw ApiError.notFound('工单不存在');
    if (ticket.userId !== user.id && user.role === 'USER') throw ApiError.forbidden();
    await prisma.ticket.update({ where: { id }, data: { status: 'CLOSED' } });
    return ok(res, { ok: true });
  }),
);

/* ============================================================== 通知 */

export const notificationRouter = Router();

notificationRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 30));
    const onlyUnread = req.query.unread === 'true';
    const where = { userId: user.id, ...(onlyUnread ? { isRead: false } : {}) };
    const [total, rows, unread] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * size, take: size }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);
    return ok(res, { items: rows, total, unread, page, size, totalPages: Math.ceil(total / size) });
  }),
);

notificationRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    return ok(res, { unread: await prisma.notification.count({ where: { userId: user.id, isRead: false } }) });
  }),
);

notificationRouter.post(
  '/read',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((i: unknown) => BigInt(String(i))) : null;
    if (ids?.length) {
      await prisma.notification.updateMany({ where: { userId: user.id, id: { in: ids } }, data: { isRead: true } });
    } else {
      await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
    }
    return ok(res, { ok: true });
  }),
);

notificationRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    await prisma.notification.deleteMany({ where: { id: BigInt(req.params.id!), userId: user.id } });
    return ok(res, { ok: true });
  }),
);

/* ============================================================== 用户 */

export const userRouter = Router();

userRouter.get(
  '/:username/profile',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const username = req.params.username!;
    const user = await prisma.user.findUnique({
      where: { username },
      include: { teamMember: { include: { team: true } }, _count: { select: { solves: true, submissions: true } } },
    });
    if (!user) throw ApiError.notFound('用户不存在');
    const isSelf = viewer?.id === user.id;
    const isStaff = Boolean(viewer && viewer.role !== 'USER');
    const solves = await prisma.solve.findMany({
      where: { userId: user.id },
      include: { challenge: { select: { id: true, title: true, categoryId: true, difficulty: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const rank = (await prisma.user.count({ where: { score: { gt: user.score }, hidden: false } })) + 1;
    const momentCount = await prisma.moment.count({ where: { userId: user.id, hidden: false } });
    return ok(res, {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatar: user.avatar ?? '',
      bio: user.bio ?? '',
      website: user.website ?? '',
      country: user.country ?? '',
      organization: user.organization ?? '',
      // score 是等级分（榜单用），points 是积分（商店用），两个都返回
      score: user.score,
      points: user.points,
      pointsRank: (await prisma.user.count({ where: { points: { gt: user.points }, hidden: false } })) + 1,
      globalRank: rank,
      solveCount: user._count.solves,
      submitCount: user._count.submissions,
      momentCount,
      team: user.teamMember?.team ? { id: user.teamMember.team.id, name: user.teamMember.team.name, avatar: user.teamMember.team.avatar } : null,
      createdAt: user.createdAt,
      lastLoginAt: isSelf || isStaff ? user.lastLoginAt : undefined,
      solvedChallenges: solves.map((s) => ({
        id: s.challenge.id,
        title: s.challenge.title,
        difficulty: s.challenge.difficulty,
        score: s.score,
        firstBlood: s.firstBlood,
        solvedAt: s.createdAt,
      })),
    });
  }),
);

userRouter.get(
  '/:username/points',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const user = await prisma.user.findUnique({ where: { username: req.params.username! } });
    if (!user) throw ApiError.notFound('用户不存在');
    if (viewer?.id !== user.id && viewer?.role === 'USER') throw ApiError.forbidden('只能查看自己的积分记录');
    const rows = await prisma.pointLog.findMany({ where: { userId: user.id }, orderBy: { id: 'desc' }, take: 100 });
    return ok(res, { balance: user.score, items: rows });
  }),
);
