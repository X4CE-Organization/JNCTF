import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { getBool, getInt } from '../lib/settings.js';
import { requireAuth, optionalUser, type AuthUser } from '../middleware/auth.js';
import { challengeValue } from '../services/scoring.js';
import { submitFlag } from '../services/submission.js';
import { audit, clientIp, notify } from '../lib/audit.js';
import { startInstance, stopInstance } from '../services/docker.js';

export const challengeRouter = Router();

/** 把题目转成前端要的形状，隐藏字段顺手剥掉 */
function shapeChallenge(
  challenge: any,
  viewer?: AuthUser,
  solvedIds: Set<string> = new Set(),
  unlockable = true,
) {
  const solved = solvedIds.has(String(challenge.id));
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description ?? '',
    hintPreview: challenge.hintPreview ?? '',
    categoryId: challenge.categoryId,
    category: challenge.category ? { id: challenge.category.id, name: challenge.category.name, slug: challenge.category.slug, color: challenge.category.color, icon: challenge.category.icon } : null,
    difficulty: challenge.difficulty,
    state: challenge.state,
    scoringType: challenge.scoringType,
    score: getBool('challenge.show_score') && unlockable ? challenge.score : null,
    minScore: challenge.minScore,
    // 动态分按当前解题人数实时算，前端展示的就是「现在交能拿多少」
    currentValue: getBool('challenge.show_score') && unlockable ? challengeValue(challenge, challenge.solveCount) : null,
    solveCount: getBool('challenge.show_solve_count') ? challenge.solveCount : null,
    attemptCount: challenge.attemptCount,
    maxAttempts: challenge.maxAttempts,
    requiresContainer: challenge.requiresContainer,
    connectionType: challenge.connectionType,
    connectionInfo: challenge.connectionInfo ?? '',
    allowDownload: challenge.allowDownload,
    allowWriteup: challenge.allowWriteup,
    authorId: challenge.authorId,
    author: challenge.author
      ? { id: challenge.author.id, username: challenge.author.username, displayName: challenge.author.displayName || challenge.author.username }
      : null,
    tags: getBool('challenge.show_tags')
      ? (challenge.tags ?? []).map((t: any) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color }))
      : [],
    files: (challenge.files ?? []).map((f: any) => ({
      id: f.id,
      filename: f.filename,
      size: f.size,
      downloads: f.downloads,
      url: f.url,
    })),
    solved,
    createdAt: challenge.createdAt,
  };
}

/** 当前用户的解题集合（练习模式） */
async function solvedSet(user?: AuthUser, competitionId = 0n): Promise<Set<string>> {
  if (!user) return new Set();
  const solves = await prisma.solve.findMany({
    where: { userId: user.id, competitionId },
    select: { challengeId: true },
  });
  return new Set(solves.map((s) => String(s.challengeId)));
}

/* ---------------------------------------------------------------- 题目列表 */

challengeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 50));
    const keyword = String(req.query.keyword ?? '').trim();
    const categorySlug = String(req.query.category ?? '').trim();
    const difficulty = String(req.query.difficulty ?? '').trim();
    const onlyUnsolved = req.query.unsolved === 'true';
    const onlySolved = req.query.solved === 'true';

    const where: any = {};
    if (!viewer || viewer.role === 'USER') where.state = 'VISIBLE';
    if (keyword) where.title = { contains: keyword, mode: 'insensitive' };
    if (difficulty) where.difficulty = difficulty;
    if (categorySlug) {
      const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
      where.categoryId = category?.id ?? -1n;
    }

    const [total, rows, solved] = await Promise.all([
      prisma.challenge.count({ where }),
      prisma.challenge.findMany({
        where,
        include: {
          category: true,
          author: { select: { id: true, username: true, displayName: true } },
          tags: { include: { tag: true } },
          files: true,
        },
        orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * size,
        take: size,
      }),
      solvedSet(viewer),
    ]);

    let items = rows.map((row) => shapeChallenge(row, viewer, solved, true));
    if (onlyUnsolved) items = items.filter((item) => !item.solved);
    if (onlySolved) items = items.filter((item) => item.solved);

    return ok(res, { items, total, page, size, totalPages: Math.ceil(total / size), solvedCount: solved.size });
  }),
);

/* ---------------------------------------------------------------- 题目详情 */

challengeRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const id = BigInt(req.params.id!);
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: {
        category: true,
        author: { select: { id: true, username: true, displayName: true } },
        tags: { include: { tag: true } },
        files: true,
        hints: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!challenge) throw ApiError.notFound('题目不存在');
    if (challenge.state === 'HIDDEN' && (!viewer || viewer.role === 'USER')) {
      throw ApiError.notFound('题目不存在');
    }

    const solved = await solvedSet(viewer);
    const unlocked = viewer
      ? await prisma.hintUnlock.findMany({ where: { userId: viewer.id, hint: { challengeId: id } }, select: { hintId: true } })
      : [];
    const unlockedIds = new Set(unlocked.map((u) => String(u.hintId)));

    const hintList = challenge.hints.map((hint) => ({
      id: hint.id,
      cost: hint.cost,
      unlocked: unlockedIds.has(String(hint.id)),
      content: unlockedIds.has(String(hint.id)) ? hint.content : null,
    }));

    const solveRows = await prisma.solve.findMany({
      where: { challengeId: id, competitionId: 0n },
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const instance = viewer
      ? await prisma.challengeInstance.findFirst({
          where: { challengeId: id, userId: viewer.id, status: 'RUNNING' },
          orderBy: { id: 'desc' },
        })
      : null;

    return ok(res, {
      ...shapeChallenge(challenge, viewer, solved),
      hints: hintList,
      solves: solveRows.map((s, index) => ({
        id: s.id,
        rank: index + 1,
        createdAt: s.createdAt,
        user: { id: s.user.id, username: s.user.username, displayName: s.user.displayName || s.user.username, avatar: s.user.avatar },
      })),
      instance: instance
        ? {
            id: instance.id,
            status: instance.status,
            host: instance.host,
            port: instance.port,
            expiresAt: instance.expiresAt,
            connection: instance.host && instance.port ? `${instance.host}:${instance.port}` : null,
          }
        : null,
    });
  }),
);

/* -------------------------------------------------------------- 提交 flag */

const submitSchema = z.object({
  flag: z.string().min(1, 'flag 不能为空').max(512),
  competitionId: z.union([z.string(), z.number()]).optional(),
});

challengeRouter.post(
  '/:id/submit',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const body = submitSchema.parse(req.body);
    const challengeId = BigInt(req.params.id!);
    const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });

    const result = await submitFlag(user, {
      challengeId,
      flag: body.flag,
      competitionId: body.competitionId ? BigInt(body.competitionId) : 0n,
      teamId: membership?.teamId ?? null,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] ?? '',
    });
    return ok(res, result);
  }),
);

/* ---------------------------------------------------------------- 提示解锁 */

challengeRouter.post(
  '/:id/hints/:hintId/unlock',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const challengeId = BigInt(req.params.id!);
    const hintId = BigInt(req.params.hintId!);

    const hint = await prisma.hint.findUnique({ where: { id: hintId } });
    if (!hint || hint.challengeId !== challengeId) throw ApiError.notFound('提示不存在');

    const existing = await prisma.hintUnlock.findUnique({
      where: { hintId_userId: { hintId, userId: user.id } },
    });
    if (existing) return ok(res, { content: hint.content, cost: 0 });

    const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { score: true } });
    if ((profile?.score ?? 0) < hint.cost) throw ApiError.badRequest('积分不足，无法解锁该提示');

    const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
    await prisma.$transaction(async (tx) => {
      await tx.hintUnlock.create({
        data: { hintId, userId: user.id, teamId: membership?.teamId ?? null, cost: hint.cost },
      });
      if (hint.cost > 0) {
        const updated = await tx.user.update({
          where: { id: user.id },
          data: { score: { decrement: hint.cost } },
        });
        await tx.pointLog.create({
          data: {
            userId: user.id,
            delta: -hint.cost,
            balance: updated.score,
            reason: '解锁提示',
            refType: 'hint',
            refId: hintId,
          },
        });
        // 如果设置从题目分里扣，把已解出的记录分数也降下来
        if (hint.deductFromChallenge) {
          await tx.solve.updateMany({
            where: { challengeId, userId: user.id },
            data: { score: { decrement: Math.min(hint.cost, 0) } },
          });
        }
      }
    });

    await audit(req, user, 'hint.unlock', 'hint', hintId);
    return ok(res, { content: hint.content, cost: hint.cost });
  }),
);

/* ---------------------------------------------------------------- 附件下载 */

challengeRouter.get(
  '/:id/files/:fileId/download',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const file = await prisma.challengeFile.findUnique({
      where: { id: BigInt(req.params.fileId!) },
      include: { challenge: true },
    });
    if (!file || file.challengeId !== BigInt(req.params.id!)) throw ApiError.notFound('附件不存在');
    if (file.challenge.state === 'HIDDEN' && (!viewer || viewer.role === 'USER')) {
      throw ApiError.notFound('附件不存在');
    }
    if (!file.challenge.allowDownload && (!viewer || viewer.role === 'USER')) {
      throw ApiError.forbidden('该题不允许下载附件');
    }
    await prisma.challengeFile.update({ where: { id: file.id }, data: { downloads: { increment: 1 } } });
    return ok(res, { url: file.url, filename: file.filename, sha256: file.sha256, size: file.size });
  }),
);

/* -------------------------------------------------------------- 动态靶机 */

challengeRouter.post(
  '/:id/instance',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const challengeId = BigInt(req.params.id!);
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw ApiError.notFound('题目不存在');
    if (!challenge.requiresContainer) throw ApiError.badRequest('这道题不需要启动靶机');

    const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
    const instance = await startInstance({
      challenge,
      userId: user.id,
      teamId: membership?.teamId ?? null,
      competitionId: 0n,
    });
    await audit(req, user, 'challenge.instance_start', 'challenge', challengeId);
    return ok(res, {
      id: instance.id,
      status: instance.status,
      host: instance.host,
      port: instance.port,
      expiresAt: instance.expiresAt,
      connection: instance.host && instance.port ? `${instance.host}:${instance.port}` : null,
      message: instance.status === 'FAILED' ? instance.errorMessage : '靶机已启动',
    });
  }),
);

challengeRouter.delete(
  '/:id/instance',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    await stopInstance(BigInt(req.params.id!), user.id);
    await audit(req, user, 'challenge.instance_stop', 'challenge', req.params.id);
    return ok(res, { ok: true });
  }),
);

/* ------------------------------------------------------------ 解题记录 */

challengeRouter.get(
  '/:id/solves',
  asyncHandler(async (req, res) => {
    const rows = await prisma.solve.findMany({
      where: { challengeId: BigInt(req.params.id!), competitionId: 0n },
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return ok(res, {
      items: rows.map((s, index) => ({
        id: s.id,
        rank: index + 1,
        score: s.score,
        createdAt: s.createdAt,
        user: { id: s.user.id, username: s.user.username, displayName: s.user.displayName || s.user.username, avatar: s.user.avatar },
      })),
    });
  }),
);

/* ------------------------------------------------------------ 我的提交 */

export const submissionRouter = Router();

submissionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 30));
    const challengeId = req.query.challengeId ? BigInt(String(req.query.challengeId)) : undefined;
    const mine = req.query.all === 'true' && user.role !== 'USER' ? {} : { userId: user.id };

    const where = { ...mine, ...(challengeId ? { challengeId } : {}) };
    const [total, rows] = await Promise.all([
      prisma.submission.count({ where }),
      prisma.submission.findMany({
        where,
        include: {
          challenge: { select: { id: true, title: true } },
          user: { select: { id: true, username: true, displayName: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((s) => ({
        id: s.id,
        challengeId: s.challengeId,
        challengeTitle: s.challenge.title,
        flag: s.status === 'CORRECT' ? s.flag : s.flag.slice(0, 6) + '***',
        status: s.status,
        score: s.score,
        username: s.user.displayName || s.user.username,
        createdAt: s.createdAt,
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);
