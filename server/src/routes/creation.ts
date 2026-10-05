import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { consumeGrant, quotaOf } from '../lib/points.js';
import { getBool } from '../lib/settings.js';

/**
 * 创作中心：用户拿商店换来的资格，自己出题 / 办赛。
 * 管理员不受资格限制，走后台那套接口也可以，这里只是给普通用户开的口子。
 */
export const creationRouter = Router();

const flagSchema = z.object({
  flag: z.string().trim().min(1).max(512),
  type: z.enum(['STATIC', 'REGEX', 'DYNAMIC']).optional(),
  caseSensitive: z.boolean().optional(),
});

const challengeInput = z.object({
  title: z.string().trim().min(2, '标题太短').max(160),
  description: z.string().max(50000).optional(),
  hintPreview: z.string().max(500).optional(),
  categoryId: z.union([z.string(), z.number()]).optional().nullable(),
  difficulty: z.enum(['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'INSANE']).optional(),
  scoringType: z.enum(['STATIC', 'DYNAMIC']).optional(),
  score: z.number().int().min(1).max(10000).optional(),
  minScore: z.number().int().min(0).max(10000).optional(),
  decay: z.number().int().min(1).max(1000).optional(),
  maxAttempts: z.number().int().min(0).max(1000).optional(),
  allowWriteup: z.boolean().optional(),
  flags: z.array(flagSchema).max(20).optional(),
  hints: z.array(z.object({ content: z.string().min(1).max(5000), cost: z.number().int().min(0).optional() })).max(20).optional(),
  tags: z.array(z.string().trim().max(48)).max(12).optional(),
});

async function syncTags(challengeId: bigint, names: string[]) {
  const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 12);
  await prisma.challengeTag.deleteMany({ where: { challengeId } });
  for (const name of cleaned) {
    const tag = await prisma.tag.upsert({ where: { name }, create: { name }, update: {} });
    await prisma.challengeTag.create({ data: { challengeId, tagId: tag.id } }).catch(() => null);
  }
}

/** 我的资格 + 我创建的内容概览 */
creationRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const isStaff = user.role !== 'USER';
    const [problem, contest, challenges, competitions] = await Promise.all([
      quotaOf(user.id, 'problem'),
      quotaOf(user.id, 'contest'),
      prisma.challenge.count({ where: { authorId: user.id } }),
      prisma.competition.count({ where: { createdBy: user.id } }),
    ]);
    return ok(res, {
      isStaff,
      problem,
      contest,
      challengeCount: challenges,
      competitionCount: competitions,
      canCreateChallenge: isStaff || (problem.remaining > 0 && getBool('community.allow_user_challenge')),
      canCreateCompetition: isStaff || (contest.remaining > 0 && getBool('community.allow_user_competition')),
    });
  }),
);

/* ------------------------------------------------------------- 我的题目 */

creationRouter.get(
  '/challenges',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const rows = await prisma.challenge.findMany({
      where: { authorId: user.id },
      include: { category: true, _count: { select: { solves: true, submissions: true } } },
      orderBy: { id: 'desc' },
    });
    return ok(res, {
      items: rows.map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category?.name ?? '',
        difficulty: c.difficulty,
        state: c.state,
        score: c.score,
        solveTotal: c._count.solves,
        submissionTotal: c._count.submissions,
        createdAt: c.createdAt,
      })),
    });
  }),
);

creationRouter.post(
  '/challenges',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (!getBool('community.allow_user_challenge')) throw ApiError.forbidden('管理员已关闭用户自主出题');
    const body = challengeInput.parse(req.body);
    if (!body.flags?.length) throw ApiError.badRequest('至少要给一个 flag');
    if (user.role === 'USER') await consumeGrant(user.id, 'problem');

    const challenge = await prisma.challenge.create({
      data: {
        title: body.title,
        description: body.description,
        hintPreview: body.hintPreview,
        categoryId: body.categoryId ? BigInt(body.categoryId) : null,
        difficulty: body.difficulty ?? 'EASY',
        state: 'VISIBLE',
        scoringType: body.scoringType ?? 'STATIC',
        score: body.score ?? 100,
        minScore: body.minScore ?? 20,
        decay: body.decay ?? 30,
        maxAttempts: body.maxAttempts ?? 0,
        allowWriteup: body.allowWriteup ?? true,
        authorId: user.id,
        flags: { create: body.flags.map((f) => ({ flag: f.flag, type: f.type ?? 'STATIC', caseSensitive: f.caseSensitive ?? true })) },
        hints: body.hints?.length
          ? { create: body.hints.map((h, i) => ({ content: h.content, cost: h.cost ?? 0, sortOrder: i })) }
          : undefined,
      },
    });
    if (body.tags?.length) await syncTags(challenge.id, body.tags);
    await audit(req, user, 'creation.challenge_create', 'challenge', challenge.id, challenge.title);
    return ok(res, { id: challenge.id }, 201);
  }),
);

creationRouter.put(
  '/challenges/:id',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const existing = await prisma.challenge.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('题目不存在');
    if (existing.authorId !== user.id && user.role === 'USER') throw ApiError.forbidden('这不是你出的题');
    const body = challengeInput.partial().extend({ state: z.enum(['VISIBLE', 'HIDDEN', 'CLOSED']).optional() }).parse(req.body);

    await prisma.challenge.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        hintPreview: body.hintPreview,
        categoryId: body.categoryId === undefined ? undefined : body.categoryId ? BigInt(body.categoryId) : null,
        difficulty: body.difficulty,
        state: body.state,
        scoringType: body.scoringType,
        score: body.score,
        minScore: body.minScore,
        decay: body.decay,
        maxAttempts: body.maxAttempts,
        allowWriteup: body.allowWriteup,
      },
    });
    if (body.flags?.length) {
      await prisma.challengeFlag.deleteMany({ where: { challengeId: id } });
      for (const f of body.flags) {
        await prisma.challengeFlag.create({
          data: { challengeId: id, flag: f.flag, type: f.type ?? 'STATIC', caseSensitive: f.caseSensitive ?? true },
        });
      }
    }
    if (body.hints) {
      await prisma.hint.deleteMany({ where: { challengeId: id } });
      for (const [i, h] of body.hints.entries()) {
        await prisma.hint.create({ data: { challengeId: id, content: h.content, cost: h.cost ?? 0, sortOrder: i } });
      }
    }
    if (body.tags) await syncTags(id, body.tags);
    await audit(req, user, 'creation.challenge_update', 'challenge', id);
    return ok(res, { ok: true });
  }),
);

creationRouter.delete(
  '/challenges/:id',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const existing = await prisma.challenge.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('题目不存在');
    if (existing.authorId !== user.id && user.role === 'USER') throw ApiError.forbidden('这不是你出的题');
    if (existing.solveCount > 0 && user.role === 'USER') {
      throw ApiError.badRequest('已经有队伍解出这道题了，不能直接删除，请先改为「隐藏」');
    }
    await prisma.challenge.delete({ where: { id } });
    await audit(req, user, 'creation.challenge_delete', 'challenge', id);
    return ok(res, { ok: true });
  }),
);

/* ------------------------------------------------------------- 我的比赛 */

const competitionInput = z.object({
  name: z.string().trim().min(2, '名称太短').max(160),
  slug: z.string().trim().regex(/^[a-zA-Z0-9-]{2,16}$/, '标识只能用字母、数字和短横线，长度 2-16'),
  subtitle: z.string().trim().max(255).optional(),
  description: z.string().max(20000).optional(),
  rules: z.string().max(20000).optional(),
  startAt: z.string().min(4),
  endAt: z.string().min(4),
  teamMode: z.enum(['SOLO', 'TEAM', 'BOTH']).optional(),
  maxParticipants: z.number().int().min(0).max(100000).optional(),
  minTeamSize: z.number().int().min(1).max(50).optional(),
  maxTeamSize: z.number().int().min(1).max(50).optional(),
  challengeIds: z.array(z.union([z.string(), z.number()])).max(200).optional(),
  published: z.boolean().optional(),
});

creationRouter.get(
  '/competitions',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const rows = await prisma.competition.findMany({
      where: { createdBy: user.id },
      include: { _count: { select: { participants: true, challenges: true } } },
      orderBy: { id: 'desc' },
    });
    return ok(res, {
      items: rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        state: c.state,
        published: c.published,
        startAt: c.startAt,
        endAt: c.endAt,
        participantCount: c._count.participants,
        challengeCount: c._count.challenges,
      })),
    });
  }),
);

creationRouter.post(
  '/competitions',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (!getBool('community.allow_user_competition')) throw ApiError.forbidden('管理员已关闭用户自主办赛');
    const body = competitionInput.parse(req.body);
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) throw ApiError.badRequest('时间格式不正确');
    if (endAt <= startAt) throw ApiError.badRequest('结束时间要晚于开始时间');
    if (await prisma.competition.findUnique({ where: { slug: body.slug } })) {
      throw ApiError.conflict('这个比赛标识已经被用了，换一个');
    }
    if (user.role === 'USER') await consumeGrant(user.id, 'contest');

    const competition = await prisma.competition.create({
      data: {
        name: body.name,
        slug: body.slug,
        subtitle: body.subtitle,
        description: body.description,
        rules: body.rules,
        type: 'JEOPARDY',
        teamMode: body.teamMode ?? 'BOTH',
        startAt,
        endAt,
        freezeAt: new Date(endAt.getTime() - 30 * 60_000),
        published: body.published ?? false,
        maxParticipants: body.maxParticipants ?? 0,
        minTeamSize: body.minTeamSize ?? 1,
        maxTeamSize: body.maxTeamSize ?? 4,
        createdBy: user.id,
      },
    });
    if (body.challengeIds?.length) {
      for (const [i, cid] of body.challengeIds.entries()) {
        await prisma.competitionChallenge.create({ data: { competitionId: competition.id, challengeId: BigInt(cid), sortOrder: i } }).catch(() => null);
      }
    }
    await audit(req, user, 'creation.competition_create', 'competition', competition.id, competition.name);
    return ok(res, { id: competition.id, slug: competition.slug }, 201);
  }),
);

creationRouter.put(
  '/competitions/:id',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const existing = await prisma.competition.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('比赛不存在');
    if (existing.createdBy !== user.id && user.role === 'USER') throw ApiError.forbidden('这不是你办的比赛');
    const body = competitionInput.partial().parse(req.body);
    await prisma.competition.update({
      where: { id },
      data: {
        name: body.name,
        subtitle: body.subtitle,
        description: body.description,
        rules: body.rules,
        teamMode: body.teamMode,
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        endAt: body.endAt ? new Date(body.endAt) : undefined,
        published: body.published,
        maxParticipants: body.maxParticipants,
        minTeamSize: body.minTeamSize,
        maxTeamSize: body.maxTeamSize,
      },
    });
    if (body.challengeIds) {
      await prisma.competitionChallenge.deleteMany({ where: { competitionId: id } });
      for (const [i, cid] of body.challengeIds.entries()) {
        await prisma.competitionChallenge.create({ data: { competitionId: id, challengeId: BigInt(cid), sortOrder: i } }).catch(() => null);
      }
    }
    await audit(req, user, 'creation.competition_update', 'competition', id);
    return ok(res, { ok: true });
  }),
);

creationRouter.delete(
  '/competitions/:id',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const existing = await prisma.competition.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('比赛不存在');
    if (existing.createdBy !== user.id && user.role === 'USER') throw ApiError.forbidden('这不是你办的比赛');
    await prisma.competition.delete({ where: { id } });
    await audit(req, user, 'creation.competition_delete', 'competition', id);
    return ok(res, { ok: true });
  }),
);
