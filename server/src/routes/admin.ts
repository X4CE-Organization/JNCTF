import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import { allSettings, resetSettings, updateSettings } from '../lib/settings.js';
import { mailConfig, sendMailDetailed, verifyMailConnection } from '../lib/mail.js';
import { sendTestSms } from '../lib/sms.js';
import { enabledProviders } from '../services/oauth.js';
import { audit, notify } from '../lib/audit.js';
import { awxDockerStats, dockerAvailable, startAwxTarget, stopAwxTarget } from '../services/awx-docker.js';
import { generateRounds } from '../services/awd.js';
import { cacheClear, redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

export const adminRouter = Router();

/* =============================================================== 概览 */

adminRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const dayAgo = new Date(Date.now() - 86_400_000);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const [
      users, newUsers, bannedUsers, admins,
      challenges, visibleChallenges,
      solves, recentSolves,
      teams, competitions, runningCompetitions,
      tickets, openTickets, pendingWriteups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { banned: true } }),
      prisma.user.count({ where: { role: { not: 'USER' } } }),
      prisma.challenge.count(),
      prisma.challenge.count({ where: { state: 'VISIBLE' } }),
      prisma.solve.count(),
      prisma.solve.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.team.count(),
      prisma.competition.count(),
      prisma.competition.count({ where: { published: true, endAt: { gt: new Date() }, startAt: { lte: new Date() } } }),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'PENDING'] } } }),
      prisma.writeup.count({ where: { state: 'PENDING' } }),
    ]);

    // 近 14 天解题趋势
    const trend: Array<{ day: string; count: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);
      const end = new Date(start.getTime() + 86_400_000);
      trend.push({
        day: start.toISOString().slice(0, 10),
        count: await prisma.solve.count({ where: { createdAt: { gte: start, lt: end } } }),
      });
    }

    const recentActions = await prisma.auditLog.findMany({ orderBy: { id: 'desc' }, take: 15 });
    const topUsers = await prisma.user.findMany({
      where: { hidden: false },
      orderBy: { score: 'desc' },
      take: 5,
      select: { id: true, username: true, displayName: true, avatar: true, score: true },
    });

    return ok(res, {
      users: { total: users, newWeek: newUsers, banned: bannedUsers, admins },
      challenges: { total: challenges, visible: visibleChallenges },
      solves: { total: solves, today: recentSolves },
      teams: { total: teams },
      competitions: { total: competitions, running: runningCompetitions },
      tickets: { total: tickets, open: openTickets },
      writeups: { pending: pendingWriteups },
      docker: await awxDockerStats().catch(() => ({ running: 0, total: 0 })),
      redis: redis.status,
      trend,
      recentActions,
      topUsers,
    });
  }),
);

/* =============================================================== 用户 */

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 30));
    const keyword = String(req.query.keyword ?? '').trim();
    const role = String(req.query.role ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const where: any = {};
    if (keyword) {
      where.OR = [
        { username: { contains: keyword, mode: 'insensitive' } },
        { email: { contains: keyword, mode: 'insensitive' } },
        { displayName: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (status) where.status = status;

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: { teamMember: { include: { team: { select: { id: true, name: true } } } }, _count: { select: { solves: true, submissions: true } } },
        orderBy: { id: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        displayName: u.displayName || u.username,
        avatar: u.avatar,
        role: u.role,
        status: u.status,
        score: u.score,
        points: u.points,
        banned: u.banned,
        banReason: u.banReason,
        hidden: u.hidden,
        team: u.teamMember?.team ?? null,
        solveCount: u._count.solves,
        submitCount: u._count.submissions,
        lastLoginAt: u.lastLoginAt,
        lastLoginIp: u.lastLoginIp,
        createdAt: u.createdAt,
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

adminRouter.put(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('用户不存在');
    const body = req.body ?? {};
    const data: any = {};

    if (typeof body.displayName === 'string') data.displayName = body.displayName.slice(0, 48);
    if (typeof body.email === 'string') data.email = body.email.trim().toLowerCase() || null;
    if (typeof body.bio === 'string') data.bio = body.bio.slice(0, 512);
    if (typeof body.banned === 'boolean') {
      data.banned = body.banned;
      data.status = body.banned ? 'BANNED' : 'ACTIVE';
      data.banReason = body.banned ? String(body.banReason ?? '').slice(0, 255) : null;
    }
    // 只有超管能改角色与积分
    if (actor.role === 'SUPER_ADMIN') {
      if (typeof body.role === 'string' && ['USER', 'ADMIN', 'SUPER_ADMIN'].includes(body.role)) data.role = body.role;
      if (typeof body.hidden === 'boolean') data.hidden = body.hidden;
      if (Number.isFinite(Number(body.score))) data.score = Number(body.score);
    }
    await prisma.user.update({ where: { id }, data });
    await audit(req, actor, 'admin.user_update', 'user', id, JSON.stringify(data));
    return ok(res, { ok: true });
  }),
);

adminRouter.post(
  '/users/:id/reset-password',
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const id = BigInt(req.params.id!);
    const newPassword = String(req.body?.newPassword ?? '').trim() || crypto.randomBytes(6).toString('hex');
    if (newPassword.length < 8) throw ApiError.badRequest('密码至少 8 位');
    const bcrypt = await import('bcryptjs');
    await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.default.hash(newPassword, 10) } });
    await notify(id, 'SYSTEM', '管理员重置了你的密码', '请登录后立即修改密码');
    await audit(req, actor, 'admin.user_reset_password', 'user', id);
    return ok(res, { password: newPassword });
  }),
);

adminRouter.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const id = BigInt(req.params.id!);
    if (id === actor.id) throw ApiError.badRequest('不能删除自己');
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('用户不存在');
    if (user.role === 'SUPER_ADMIN') throw ApiError.forbidden('不能删除超级管理员');
    await prisma.user.delete({ where: { id } });
    await audit(req, actor, 'admin.user_delete', 'user', id, user.username);
    return ok(res, { ok: true });
  }),
);

/* =============================================================== 题目 */

adminRouter.get(
  '/challenges',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 30));
    const keyword = String(req.query.keyword ?? '').trim();
    const state = String(req.query.state ?? '').trim();
    const where: any = {};
    if (keyword) where.title = { contains: keyword, mode: 'insensitive' };
    if (state) where.state = state;
    const [total, rows] = await Promise.all([
      prisma.challenge.count({ where }),
      prisma.challenge.findMany({
        where,
        include: { category: true, _count: { select: { solves: true, submissions: true, files: true } }, flags: true, hints: true },
        orderBy: { id: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((c) => ({
        id: c.id,
        title: c.title,
        categoryId: c.categoryId,
        category: c.category?.name ?? '',
        difficulty: c.difficulty,
        state: c.state,
        scoringType: c.scoringType,
        score: c.score,
        minScore: c.minScore,
        decay: c.decay,
        solveCount: c.solveCount,
        attemptCount: c.attemptCount,
        flagCount: c.flags.length,
        hintCount: c.hints.length,
        fileCount: c._count.files,
        solveTotal: c._count.solves,
        requiresContainer: c.requiresContainer,
        dockerImage: c.dockerImage,
        createdAt: c.createdAt,
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

const challengeSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().optional(),
  hintPreview: z.string().optional(),
  categoryId: z.union([z.string(), z.number()]).optional().nullable(),
  difficulty: z.enum(['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'INSANE']).optional(),
  state: z.enum(['VISIBLE', 'HIDDEN', 'CLOSED']).optional(),
  scoringType: z.enum(['STATIC', 'DYNAMIC']).optional(),
  score: z.number().int().min(1).max(10000).optional(),
  minScore: z.number().int().min(0).max(10000).optional(),
  decay: z.number().int().min(1).max(1000).optional(),
  maxAttempts: z.number().int().min(0).max(1000).optional(),
  requiresContainer: z.boolean().optional(),
  dockerImage: z.string().max(255).optional().nullable(),
  containerPort: z.number().int().optional().nullable(),
  connectionType: z.string().max(16).optional(),
  connectionInfo: z.string().optional(),
  memoryLimitMb: z.number().int().min(32).max(8192).optional(),
  cpuLimit: z.string().max(16).optional(),
  instanceTtlSeconds: z.number().int().min(60).max(86400).optional(),
  allowDownload: z.boolean().optional(),
  allowWriteup: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  flags: z.array(z.object({
    flag: z.string().min(1).max(512),
    type: z.enum(['STATIC', 'REGEX', 'DYNAMIC']).optional(),
    caseSensitive: z.boolean().optional(),
  })).optional(),
  hints: z.array(z.object({ content: z.string().min(1), cost: z.number().int().min(0).optional() })).optional(),
  tags: z.array(z.string().max(48)).optional(),
  files: z.array(z.object({ filename: z.string(), url: z.string(), size: z.number().optional(), sha256: z.string().optional() })).optional(),
});

adminRouter.post(
  '/challenges',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const body = challengeSchema.parse(req.body);
    const challenge = await prisma.challenge.create({
      data: {
        title: body.title,
        description: body.description,
        hintPreview: body.hintPreview,
        categoryId: body.categoryId ? BigInt(body.categoryId) : null,
        difficulty: body.difficulty ?? 'EASY',
        state: body.state ?? 'VISIBLE',
        scoringType: body.scoringType ?? 'STATIC',
        score: body.score ?? 100,
        minScore: body.minScore ?? 20,
        decay: body.decay ?? 30,
        maxAttempts: body.maxAttempts ?? 0,
        requiresContainer: body.requiresContainer ?? false,
        dockerImage: body.dockerImage ?? null,
        containerPort: body.containerPort ?? null,
        connectionType: body.connectionType ?? 'tcp',
        connectionInfo: body.connectionInfo,
        memoryLimitMb: body.memoryLimitMb ?? 256,
        cpuLimit: body.cpuLimit ?? '0.5',
        instanceTtlSeconds: body.instanceTtlSeconds ?? 3600,
        allowDownload: body.allowDownload ?? true,
        allowWriteup: body.allowWriteup ?? true,
        sortOrder: body.sortOrder ?? 0,
        authorId: actor.id,
        flags: body.flags?.length ? { create: body.flags.map((f) => ({ flag: f.flag, type: f.type ?? 'STATIC', caseSensitive: f.caseSensitive ?? true })) } : undefined,
        hints: body.hints?.length ? { create: body.hints.map((h, i) => ({ content: h.content, cost: h.cost ?? 0, sortOrder: i })) } : undefined,
        files: body.files?.length ? { create: body.files.map((f) => ({ filename: f.filename, url: f.url, size: BigInt(f.size ?? 0), sha256: f.sha256 })) } : undefined,
      },
    });
    if (body.tags?.length) await syncTags(challenge.id, body.tags);
    await audit(req, actor, 'admin.challenge_create', 'challenge', challenge.id, challenge.title);
    return ok(res, { id: challenge.id }, 201);
  }),
);

adminRouter.put(
  '/challenges/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const existing = await prisma.challenge.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('题目不存在');
    const body = challengeSchema.partial().parse(req.body);

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
        requiresContainer: body.requiresContainer,
        dockerImage: body.dockerImage,
        containerPort: body.containerPort,
        connectionType: body.connectionType,
        connectionInfo: body.connectionInfo,
        memoryLimitMb: body.memoryLimitMb,
        cpuLimit: body.cpuLimit,
        instanceTtlSeconds: body.instanceTtlSeconds,
        allowDownload: body.allowDownload,
        allowWriteup: body.allowWriteup,
        sortOrder: body.sortOrder,
      },
    });

    if (body.flags) {
      await prisma.challengeFlag.deleteMany({ where: { challengeId: id } });
      await prisma.challengeFlag.createMany({
        data: body.flags.map((f) => ({ challengeId: id, flag: f.flag, type: f.type ?? 'STATIC', caseSensitive: f.caseSensitive ?? true })),
      });
    }
    if (body.hints) {
      await prisma.hint.deleteMany({ where: { challengeId: id } });
      await prisma.hint.createMany({ data: body.hints.map((h, i) => ({ challengeId: id, content: h.content, cost: h.cost ?? 0, sortOrder: i })) });
    }
    if (body.files) {
      await prisma.challengeFile.deleteMany({ where: { challengeId: id } });
      await prisma.challengeFile.createMany({
        data: body.files.map((f) => ({ challengeId: id, filename: f.filename, url: f.url, size: BigInt(f.size ?? 0), sha256: f.sha256 })),
      });
    }
    if (body.tags) await syncTags(id, body.tags);

    await audit(req, actor, 'admin.challenge_update', 'challenge', id);
    return ok(res, { ok: true });
  }),
);

adminRouter.delete(
  '/challenges/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    await prisma.challenge.delete({ where: { id } });
    await audit(req, actor, 'admin.challenge_delete', 'challenge', id);
    return ok(res, { ok: true });
  }),
);

async function syncTags(challengeId: bigint, names: string[]) {
  await prisma.challengeTag.deleteMany({ where: { challengeId } });
  for (const raw of names.slice(0, 10)) {
    const name = raw.trim().slice(0, 48);
    if (!name) continue;
    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name },
      update: { usageCount: { increment: 1 } },
    });
    await prisma.challengeTag.create({ data: { challengeId, tagId: tag.id } }).catch(() => undefined);
  }
}

/* =============================================================== 分类 */

adminRouter.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const body = req.body ?? {};
    const name = String(body.name ?? '').trim();
    const slug = String(body.slug ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!name || !slug) throw ApiError.badRequest('名称和标识都要填');
    if (await prisma.category.findUnique({ where: { slug } })) throw ApiError.conflict('该标识已被占用');
    const category = await prisma.category.create({
      data: { name, slug, description: body.description ?? null, icon: body.icon ?? null, color: body.color ?? null, sortOrder: Number(body.sortOrder ?? 0), visible: body.visible !== false },
    });
    await audit(req, actor, 'admin.category_create', 'category', category.id, name);
    return ok(res, { id: category.id }, 201);
  }),
);

adminRouter.put(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const body = req.body ?? {};
    await prisma.category.update({
      where: { id },
      data: {
        name: typeof body.name === 'string' ? body.name.slice(0, 48) : undefined,
        description: body.description,
        icon: body.icon,
        color: body.color,
        sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
        visible: typeof body.visible === 'boolean' ? body.visible : undefined,
      },
    });
    await audit(req, actor, 'admin.category_update', 'category', id);
    return ok(res, { ok: true });
  }),
);

adminRouter.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    await prisma.category.delete({ where: { id } });
    await audit(req, actor, 'admin.category_delete', 'category', id);
    return ok(res, { ok: true });
  }),
);

/* =============================================================== 比赛 */

adminRouter.get(
  '/competitions',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const rows = await prisma.competition.findMany({
      include: { _count: { select: { participants: true, challenges: true, awxServices: true, awxRounds: true } } },
      orderBy: { id: 'desc' },
    });
    return ok(res, {
      items: rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        type: c.type,
        state: c.state,
        published: c.published,
        teamMode: c.teamMode,
        startAt: c.startAt,
        endAt: c.endAt,
        freezeAt: c.freezeAt,
        joinPassword: c.joinPassword ? '******' : '',
        needApproval: c.needApproval,
        participantCount: c._count.participants,
        challengeCount: c._count.challenges,
        serviceCount: c._count.awxServices,
        roundCount: c._count.awxRounds,
        awdRoundSeconds: c.awdRoundSeconds,
        awdAttackScore: c.awdAttackScore,
        awdDefensePenalty: c.awdDefensePenalty,
      })),
    });
  }),
);

const competitionSchema = z.object({
  name: z.string().trim().min(2).max(160),
  subtitle: z.string().max(255).optional(),
  slug: z.string().trim().min(2).max(16),
  description: z.string().optional(),
  rules: z.string().optional(),
  banner: z.string().max(512).optional(),
  type: z.enum(['JEOPARDY', 'AWD', 'MIXED']).optional(),
  teamMode: z.enum(['SOLO', 'TEAM', 'BOTH']).optional(),
  startAt: z.string(),
  endAt: z.string(),
  freezeAt: z.string().optional().nullable(),
  published: z.boolean().optional(),
  joinPassword: z.string().max(64).optional().nullable(),
  maxParticipants: z.number().int().min(0).optional(),
  minTeamSize: z.number().int().min(1).optional(),
  maxTeamSize: z.number().int().min(1).optional(),
  needApproval: z.boolean().optional(),
  hideScoreboard: z.boolean().optional(),
  hideChallenges: z.boolean().optional(),
  practiceAfter: z.boolean().optional(),
  awdRoundSeconds: z.number().int().min(60).max(86_400).optional(),
  awdAttackScore: z.number().int().min(0).optional(),
  awdDefensePenalty: z.number().int().min(0).optional(),
  challengeIds: z.array(z.union([z.string(), z.number()])).optional(),
});

adminRouter.post(
  '/competitions',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const body = competitionSchema.parse(req.body);
    if (await prisma.competition.findUnique({ where: { slug: body.slug } })) throw ApiError.conflict('该标识已被占用');
    const competition = await prisma.competition.create({
      data: {
        name: body.name,
        subtitle: body.subtitle,
        slug: body.slug,
        description: body.description,
        rules: body.rules,
        banner: body.banner,
        type: body.type ?? 'JEOPARDY',
        teamMode: body.teamMode ?? 'BOTH',
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        freezeAt: body.freezeAt ? new Date(body.freezeAt) : null,
        published: body.published ?? false,
        joinPassword: body.joinPassword || null,
        maxParticipants: body.maxParticipants ?? 0,
        minTeamSize: body.minTeamSize ?? 1,
        maxTeamSize: body.maxTeamSize ?? 4,
        needApproval: body.needApproval ?? false,
        hideScoreboard: body.hideScoreboard ?? false,
        hideChallenges: body.hideChallenges ?? false,
        practiceAfter: body.practiceAfter ?? true,
        awdRoundSeconds: body.awdRoundSeconds ?? 300,
        awdAttackScore: body.awdAttackScore ?? 50,
        awdDefensePenalty: body.awdDefensePenalty ?? 50,
        createdBy: actor.id,
      },
    });
    if (body.challengeIds?.length) {
      await prisma.competitionChallenge.createMany({
        data: body.challengeIds.map((cid, index) => ({ competitionId: competition.id, challengeId: BigInt(cid), sortOrder: index })),
      });
    }
    await audit(req, actor, 'admin.competition_create', 'competition', competition.id, competition.name);
    return ok(res, { id: competition.id }, 201);
  }),
);

adminRouter.put(
  '/competitions/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const body = competitionSchema.partial().parse(req.body);
    await prisma.competition.update({
      where: { id },
      data: {
        name: body.name,
        subtitle: body.subtitle,
        description: body.description,
        rules: body.rules,
        banner: body.banner,
        type: body.type,
        teamMode: body.teamMode,
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        endAt: body.endAt ? new Date(body.endAt) : undefined,
        freezeAt: body.freezeAt === undefined ? undefined : body.freezeAt ? new Date(body.freezeAt) : null,
        published: body.published,
        joinPassword: body.joinPassword === undefined ? undefined : body.joinPassword || null,
        maxParticipants: body.maxParticipants,
        minTeamSize: body.minTeamSize,
        maxTeamSize: body.maxTeamSize,
        needApproval: body.needApproval,
        hideScoreboard: body.hideScoreboard,
        hideChallenges: body.hideChallenges,
        practiceAfter: body.practiceAfter,
        awdRoundSeconds: body.awdRoundSeconds,
        awdAttackScore: body.awdAttackScore,
        awdDefensePenalty: body.awdDefensePenalty,
      },
    });
    if (body.challengeIds) {
      await prisma.competitionChallenge.deleteMany({ where: { competitionId: id } });
      if (body.challengeIds.length) {
        await prisma.competitionChallenge.createMany({
          data: body.challengeIds.map((cid, index) => ({ competitionId: id, challengeId: BigInt(cid), sortOrder: index })),
        });
      }
    }
    await audit(req, actor, 'admin.competition_update', 'competition', id);
    return ok(res, { ok: true });
  }),
);

adminRouter.delete(
  '/competitions/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    await prisma.competition.delete({ where: { id } });
    await audit(req, actor, 'admin.competition_delete', 'competition', id);
    return ok(res, { ok: true });
  }),
);

adminRouter.post(
  '/competitions/:id/participants/:userId/review',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const competitionId = BigInt(req.params.id!);
    const userId = BigInt(req.params.userId!);
    const approve = req.body?.approve !== false;
    await prisma.competitionParticipant.update({
      where: { competitionId_userId: { competitionId, userId } },
      data: { status: approve ? 'APPROVED' : 'REJECTED' },
    });
    await notify(userId, 'COMPETITION', approve ? '参赛申请已通过' : '参赛申请未通过', '', `/competitions`);
    await audit(req, actor, 'admin.competition_review', 'competition', competitionId, String(userId));
    return ok(res, { ok: true });
  }),
);

adminRouter.post(
  '/competitions/:id/announcement',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const competitionId = BigInt(req.params.id!);
    const title = String(req.body?.title ?? '').trim();
    const content = String(req.body?.content ?? '').trim();
    if (!title || !content) throw ApiError.badRequest('标题和内容都要填');
    const item = await prisma.competitionAnnouncement.create({ data: { competitionId, title, content, createdBy: actor.id } });
    const participants = await prisma.competitionParticipant.findMany({ where: { competitionId }, select: { userId: true } });
    for (const p of participants) await notify(p.userId, 'COMPETITION', title, content.slice(0, 200));
    await audit(req, actor, 'admin.competition_announce', 'competition', competitionId, title);
    return ok(res, { id: item.id }, 201);
  }),
);

/* ============================================================ AWD 服务 */

adminRouter.get(
  '/competitions/:id/awx-services',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const rows = await prisma.awxService.findMany({
      where: { competitionId: BigInt(req.params.id!) },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { targets: true } } },
    });
    return ok(res, { items: rows, dockerEnabled: dockerAvailable() });
  }),
);

adminRouter.post(
  '/competitions/:id/awx-services',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const competitionId = BigInt(req.params.id!);
    const body = req.body ?? {};
    if (!body.name || !body.dockerImage || !body.internalPort) throw ApiError.badRequest('名称、镜像、端口都要填');
    const service = await prisma.awxService.create({
      data: {
        competitionId,
        challengeId: body.challengeId ? BigInt(body.challengeId) : null,
        name: String(body.name).slice(0, 120),
        description: body.description ?? null,
        dockerImage: String(body.dockerImage).slice(0, 255),
        internalPort: Number(body.internalPort),
        protocol: body.protocol ?? 'tcp',
        flagEnv: body.flagEnv ?? 'FLAG',
        flagFile: body.flagFile ?? null,
        flagTemplate: body.flagTemplate ?? 'flag{{{random}}}',
        checkPath: body.checkPath ?? null,
        checkerScript: body.checkerScript ?? null,
        baseScore: Number(body.baseScore ?? 0),
        cpuLimit: body.cpuLimit ?? '1',
        memoryLimitMb: Number(body.memoryLimitMb ?? 512),
        sortOrder: Number(body.sortOrder ?? 0),
      },
    });
    await audit(req, actor, 'admin.awx_service_create', 'awx_service', service.id, service.name);
    return ok(res, { id: service.id }, 201);
  }),
);

adminRouter.put(
  '/awx-services/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const body = req.body ?? {};
    await prisma.awxService.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        dockerImage: body.dockerImage,
        internalPort: body.internalPort === undefined ? undefined : Number(body.internalPort),
        protocol: body.protocol,
        flagEnv: body.flagEnv,
        flagFile: body.flagFile,
        flagTemplate: body.flagTemplate,
        checkPath: body.checkPath,
        checkerScript: body.checkerScript,
        baseScore: body.baseScore === undefined ? undefined : Number(body.baseScore),
        cpuLimit: body.cpuLimit,
        memoryLimitMb: body.memoryLimitMb === undefined ? undefined : Number(body.memoryLimitMb),
        sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
      },
    });
    await audit(req, actor, 'admin.awx_service_update', 'awx_service', id);
    return ok(res, { ok: true });
  }),
);

adminRouter.delete(
  '/awx-services/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const targets = await prisma.awxTarget.findMany({ where: { awxServiceId: id } });
    for (const target of targets) await stopAwxTarget(target).catch(() => undefined);
    await prisma.awxService.delete({ where: { id } });
    await audit(req, actor, 'admin.awx_service_delete', 'awx_service', id);
    return ok(res, { ok: true });
  }),
);

adminRouter.post(
  '/competitions/:id/awx-rounds',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const competitionId = BigInt(req.params.id!);
    const count = await generateRounds(competitionId);
    await audit(req, actor, 'admin.awx_generate_rounds', 'competition', competitionId, String(count));
    return ok(res, { rounds: count });
  }),
);

/* =============================================================== 题解 */

adminRouter.get(
  '/writeups',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const state = String(req.query.state ?? '').trim();
    const rows = await prisma.writeup.findMany({
      where: state ? { state: state as any } : {},
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        challenge: { select: { id: true, title: true } },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });
    return ok(res, { items: rows });
  }),
);

adminRouter.post(
  '/writeups/:id/review',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const approve = req.body?.approve !== false;
    const writeup = await prisma.writeup.update({
      where: { id },
      data: { state: approve ? 'APPROVED' : 'REJECTED', rejectReason: approve ? null : String(req.body?.reason ?? '').slice(0, 255) },
    });
    await notify(
      writeup.userId,
      'WRITEUP',
      approve ? `你的题解《${writeup.title}》已通过` : `你的题解《${writeup.title}》未通过`,
      approve ? '' : String(req.body?.reason ?? ''),
    );
    await audit(req, actor, 'admin.writeup_review', 'writeup', id);
    return ok(res, { ok: true });
  }),
);

/* =============================================================== 工单 */

adminRouter.get(
  '/tickets',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 30));
    const status = String(req.query.status ?? '').trim();
    const keyword = String(req.query.keyword ?? '').trim();
    const where: any = {};
    if (status) where.status = status;
    if (keyword) where.subject = { contains: keyword, mode: 'insensitive' };
    const [total, rows] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, displayName: true } },
          assignee: { select: { id: true, username: true, displayName: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return ok(res, { items: rows, total, page, size, totalPages: Math.ceil(total / size) });
  }),
);

adminRouter.put(
  '/tickets/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const body = req.body ?? {};
    const data: any = {};
    if (typeof body.status === 'string' && ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'].includes(body.status)) data.status = body.status;
    if (typeof body.priority === 'string') data.priority = body.priority;
    if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId ? BigInt(body.assigneeId) : null;
    await prisma.ticket.update({ where: { id }, data });
    await audit(req, actor, 'admin.ticket_update', 'ticket', id, JSON.stringify(data));
    return ok(res, { ok: true });
  }),
);

/* =============================================================== 公告 */

adminRouter.post(
  '/announcements',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const title = String(req.body?.title ?? '').trim();
    const content = String(req.body?.content ?? '').trim();
    if (!title || !content) throw ApiError.badRequest('标题和内容都要填');
    const item = await prisma.announcement.create({
      data: {
        title: title.slice(0, 200),
        content,
        level: String(req.body?.level ?? 'INFO'),
        pinned: Boolean(req.body?.pinned),
        visible: req.body?.visible !== false,
        createdBy: actor.id,
      },
    });
    await audit(req, actor, 'admin.announcement_create', 'announcement', item.id, title);
    return ok(res, { id: item.id }, 201);
  }),
);

adminRouter.put(
  '/announcements/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const body = req.body ?? {};
    await prisma.announcement.update({
      where: { id },
      data: {
        title: typeof body.title === 'string' ? body.title.slice(0, 200) : undefined,
        content: body.content,
        level: body.level,
        pinned: typeof body.pinned === 'boolean' ? body.pinned : undefined,
        visible: typeof body.visible === 'boolean' ? body.visible : undefined,
      },
    });
    await audit(req, actor, 'admin.announcement_update', 'announcement', id);
    return ok(res, { ok: true });
  }),
);

adminRouter.delete(
  '/announcements/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    await prisma.announcement.delete({ where: { id } });
    await audit(req, actor, 'admin.announcement_delete', 'announcement', id);
    return ok(res, { ok: true });
  }),
);

/* =============================================================== 系统 */

adminRouter.get(
  '/settings',
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    return ok(res, await allSettings());
  }),
);

adminRouter.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const changed = await updateSettings(req.body?.values ?? req.body ?? {});
    await audit(req, actor, 'admin.settings_update', 'setting', null, changed.join(','));
    return ok(res, { changed });
  }),
);

adminRouter.post(
  '/settings/reset',
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const keys = Array.isArray(req.body?.keys) ? req.body.keys.map(String) : undefined;
    await resetSettings(keys);
    await audit(req, actor, 'admin.settings_reset', 'setting', null, keys?.join(',') ?? 'all');
    return ok(res, { ok: true });
  }),
);

/* ---------------------------------------------------------- 通道自检 */

/** 看看当前 SMTP 配置长什么样（不返回密码），并可选真实连一次 */
adminRouter.get(
  '/mail/status',
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    const cfg = mailConfig();
    return ok(res, {
      enabled: cfg.enabled,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      user: cfg.user,
      hasPassword: Boolean(cfg.pass),
      from: cfg.from,
    });
  }),
);

/** 发一封测试邮件；只带 to 时先做连通性检查 */
adminRouter.post(
  '/mail/test',
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const to = String(req.body?.to ?? '').trim();
    const verify = await verifyMailConnection();
    if (!verify.ok && !verify.skipped) {
      return ok(res, { ok: false, stage: 'connect', error: verify.error });
    }
    if (verify.skipped) return ok(res, { ok: false, stage: 'config', error: verify.error });
    if (!to) return ok(res, { ok: true, stage: 'connect', message: 'SMTP 连接正常' });
    const sent = await sendMailDetailed(to, '【JNCTF】测试邮件', '如果你收到这封邮件，说明 SMTP 配置已经生效。');
    await audit(req, actor, 'admin.mail_test', 'setting', null, to);
    return ok(res, { ok: sent.ok, stage: sent.ok ? 'sent' : 'send', error: sent.error });
  }),
);

/** 发一条测试短信 */
adminRouter.post(
  '/sms/test',
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const phone = String(req.body?.phone ?? '').replace(/[\s-]/g, '');
    if (!phone) throw ApiError.badRequest('请填写手机号');
    const code = String(crypto.randomInt(100000, 999999));
    const result = await sendTestSms(phone, code);
    await audit(req, actor, 'admin.sms_test', 'setting', null, phone);
    return ok(res, {
      ok: result.ok,
      error: result.error,
      // 通道为 none 且开了调试回显时，把验证码带回来方便自测
      devCode: result.debugCode,
    });
  }),
);

/** 第三方登录通道状态，后台一眼看出哪个没配全 */
adminRouter.get(
  '/oauth/status',
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    return ok(res, { items: enabledProviders() });
  }),
);

adminRouter.get(
  '/logs',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(200, Math.max(1, Number(req.query.size) || 50));
    const keyword = String(req.query.keyword ?? '').trim();
    const where = keyword
      ? { OR: [{ action: { contains: keyword, mode: 'insensitive' as const } }, { actorName: { contains: keyword, mode: 'insensitive' as const } }] }
      : {};
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * size, take: size }),
    ]);
    return ok(res, { items: rows, total, page, size, totalPages: Math.ceil(total / size) });
  }),
);

adminRouter.get(
  '/logs/login',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const rows = await prisma.loginLog.findMany({ orderBy: { id: 'desc' }, take: 200 });
    return ok(res, { items: rows });
  }),
);

adminRouter.get(
  '/system',
  asyncHandler(async (req, res) => {
    requireSuperAdmin(req);
    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch (err) {
      logger.warn({ err }, '数据库探活失败');
    }
    const counts = await prisma.$transaction([
      prisma.user.count(),
      prisma.challenge.count(),
      prisma.submission.count(),
      prisma.attachment.count(),
    ]);
    return ok(res, {
      database: { connected: dbOk },
      redis: { connected: redis.status === 'ready', status: redis.status },
      docker: await awxDockerStats().catch(() => ({ enabled: 0, running: 0, total: 0 })),
      counts: { users: counts[0], challenges: counts[1], submissions: counts[2], attachments: counts[3] },
      runtime: {
        node: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        env: process.env.NODE_ENV ?? 'development',
      },
    });
  }),
);

adminRouter.post(
  '/cache/clear',
  asyncHandler(async (req, res) => {
    const actor = requireSuperAdmin(req);
    const removed = await cacheClear();
    await audit(req, actor, 'admin.cache_clear', 'cache', null, String(removed));
    return ok(res, { removed });
  }),
);

/** 比赛封榜结算：把选手分数写回参赛记录 */
adminRouter.post(
  '/competitions/:id/settle',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const { freezeCompetitionScore } = await import('../services/scoreboard.js');
    const updated = await freezeCompetitionScore(BigInt(req.params.id!));
    await audit(req, actor, 'admin.competition_settle', 'competition', req.params.id, String(updated));
    return ok(res, { updated });
  }),
);

/* ======================================================= 商店管理 */

adminRouter.get(
  '/shop/items',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const rows = await prisma.shopItem.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] });
    const sold = await prisma.shopOrder.groupBy({ by: ['itemId'], _count: { _all: true } });
    const soldMap = new Map(sold.map((s) => [String(s.itemId), s._count._all]));
    return ok(res, { items: rows.map((i) => ({ ...i, soldCount: soldMap.get(String(i.id)) ?? 0 })) });
  }),
);

const shopItemSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]{2,64}$/).optional(),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).optional(),
  icon: z.string().max(32).optional(),
  price: z.number().int().min(0).max(1_000_000),
  kind: z.enum(['problem', 'contest']),
  grantAmount: z.number().int().min(1).max(100).optional(),
  stock: z.number().int().min(-1).max(1_000_000).optional(),
  maxPerUser: z.number().int().min(0).max(1000).optional(),
  active: z.boolean().optional(),
  sort: z.number().int().min(0).max(9999).optional(),
});

adminRouter.post(
  '/shop/items',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const body = shopItemSchema.parse(req.body);
    const slug = body.slug ?? `item-${crypto.randomBytes(3).toString('hex')}`;
    if (await prisma.shopItem.findUnique({ where: { slug } })) throw ApiError.conflict('这个标识已经存在');
    const item = await prisma.shopItem.create({
      data: {
        slug,
        name: body.name,
        description: body.description ?? '',
        icon: body.icon ?? 'package',
        price: body.price,
        kind: body.kind,
        grantAmount: body.grantAmount ?? 1,
        stock: body.stock ?? -1,
        maxPerUser: body.maxPerUser ?? 0,
        active: body.active ?? true,
        sort: body.sort ?? 0,
      },
    });
    await audit(req, actor, 'admin.shop_item_create', 'shop_item', item.id, item.name);
    return ok(res, { id: item.id }, 201);
  }),
);

adminRouter.put(
  '/shop/items/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const body = shopItemSchema.partial().parse(req.body);
    await prisma.shopItem.update({ where: { id }, data: body });
    await audit(req, actor, 'admin.shop_item_update', 'shop_item', id);
    return ok(res, { ok: true });
  }),
);

adminRouter.delete(
  '/shop/items/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    await prisma.shopItem.update({ where: { id }, data: { active: false } });
    await audit(req, actor, 'admin.shop_item_offline', 'shop_item', id);
    return ok(res, { ok: true });
  }),
);

adminRouter.get(
  '/shop/orders',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 30));
    const [total, rows] = await Promise.all([
      prisma.shopOrder.count(),
      prisma.shopOrder.findMany({
        include: { user: { select: { id: true, username: true, displayName: true } } },
        orderBy: { id: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        user: { id: o.user.id, username: o.user.username, displayName: o.user.displayName || o.user.username },
        itemName: o.itemName,
        kind: o.kind,
        price: o.price,
        status: o.status,
        createdAt: o.createdAt,
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

/** 手动给某个用户发资格（补偿 / 奖励用） */
adminRouter.post(
  '/shop/grant',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const body = z
      .object({
        username: z.string().trim().min(1),
        kind: z.enum(['problem', 'contest']),
        amount: z.number().int().min(1).max(100),
        note: z.string().max(200).optional(),
      })
      .parse(req.body);
    const target = await prisma.user.findUnique({ where: { username: body.username } });
    if (!target) throw ApiError.notFound('用户不存在');
    const { grantQuota } = await import('../lib/points.js');
    await grantQuota(target.id, body.kind, body.amount, { note: body.note ?? `管理员发放：${actor.username}` });
    await audit(req, actor, 'admin.shop_grant', 'user', target.id, `${body.kind} x${body.amount}`);
    await notify(target.id, 'SYSTEM', '你收到了新的资格', `${body.kind === 'problem' ? '出题' : '办赛'}资格 +${body.amount}`, '/creation');
    return ok(res, { ok: true });
  }),
);

/** 调整用户积分 */
adminRouter.post(
  '/points/adjust',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const body = z
      .object({
        username: z.string().trim().min(1),
        delta: z.number().int().min(-1_000_000).max(1_000_000),
        reason: z.string().max(120).optional(),
      })
      .parse(req.body);
    const target = await prisma.user.findUnique({ where: { username: body.username } });
    if (!target) throw ApiError.notFound('用户不存在');
    const { addPoints } = await import('../lib/points.js');
    const result = await addPoints(target.id, body.delta, body.reason || `管理员调整（${actor.username}）`, { refType: 'admin' });
    await audit(req, actor, 'admin.points_adjust', 'user', target.id, `${body.delta} -> ${result.balance}`);
    return ok(res, result);
  }),
);

/* ======================================================= 社区管理 */

adminRouter.get(
  '/moments',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 30));
    const [total, rows] = await Promise.all([
      prisma.moment.count(),
      prisma.moment.findMany({
        include: { user: { select: { id: true, username: true, displayName: true } } },
        orderBy: { id: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((m) => ({
        id: m.id,
        content: m.content,
        hidden: m.hidden,
        pinned: m.pinned,
        likeCount: m.likeCount,
        commentCount: m.commentCount,
        createdAt: m.createdAt,
        user: { id: m.user.id, username: m.user.username, displayName: m.user.displayName || m.user.username },
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

adminRouter.put(
  '/moments/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const body = z.object({ hidden: z.boolean().optional(), pinned: z.boolean().optional() }).parse(req.body);
    const moment = await prisma.moment.update({ where: { id }, data: body });
    await audit(req, actor, 'admin.moment_update', 'moment', id);
    if (moment.hidden) {
      await notify(moment.userId, 'SYSTEM', '你的动态被隐藏了', body.hidden ? '管理员将其设为不可见' : '', '/moments');
    }
    return ok(res, { ok: true });
  }),
);

adminRouter.delete(
  '/moments/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    await prisma.moment.delete({ where: { id } });
    await audit(req, actor, 'admin.moment_delete', 'moment', id);
    return ok(res, { ok: true });
  }),
);

adminRouter.get(
  '/discussions',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 30));
    const [total, rows] = await Promise.all([
      prisma.discussion.count(),
      prisma.discussion.findMany({
        include: { user: { select: { id: true, username: true, displayName: true } } },
        orderBy: { id: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((d) => ({
        id: d.id,
        board: d.board,
        title: d.title,
        hidden: d.hidden,
        pinned: d.pinned,
        locked: d.locked,
        replyCount: d.replyCount,
        views: d.views,
        createdAt: d.createdAt,
        user: { id: d.user.id, username: d.user.username, displayName: d.user.displayName || d.user.username },
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

adminRouter.put(
  '/discussions/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const body = z
      .object({ hidden: z.boolean().optional(), pinned: z.boolean().optional(), locked: z.boolean().optional() })
      .parse(req.body);
    await prisma.discussion.update({ where: { id }, data: body });
    await audit(req, actor, 'admin.discussion_update', 'discussion', id);
    return ok(res, { ok: true });
  }),
);

adminRouter.delete(
  '/discussions/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    await prisma.discussion.delete({ where: { id } });
    await audit(req, actor, 'admin.discussion_delete', 'discussion', id);
    return ok(res, { ok: true });
  }),
);

adminRouter.get(
  '/articles',
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 30));
    const state = String(req.query.state ?? '').trim();
    const where = state ? { state } : {};
    const [total, rows] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        include: { user: { select: { id: true, username: true, displayName: true } } },
        orderBy: { id: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        state: a.state,
        hidden: a.hidden,
        pinned: a.pinned,
        views: a.views,
        createdAt: a.createdAt,
        user: { id: a.user.id, username: a.user.username, displayName: a.user.displayName || a.user.username },
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

adminRouter.put(
  '/articles/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    const body = z
      .object({ state: z.enum(['PENDING', 'APPROVED']).optional(), hidden: z.boolean().optional(), pinned: z.boolean().optional() })
      .parse(req.body);
    const article = await prisma.article.update({ where: { id }, data: body });
    await audit(req, actor, 'admin.article_update', 'article', id, JSON.stringify(body));
    if (body.state === 'APPROVED') {
      await notify(article.userId, 'SYSTEM', `文章《${article.title}》已通过审核`, '', `/articles/${article.id}`);
    } else if (body.state === 'PENDING') {
      await notify(article.userId, 'SYSTEM', `文章《${article.title}》未通过审核`, '', '/articles');
    }
    return ok(res, { ok: true });
  }),
);

adminRouter.delete(
  '/articles/:id',
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const id = BigInt(req.params.id!);
    await prisma.article.delete({ where: { id } });
    await audit(req, actor, 'admin.article_delete', 'article', id);
    return ok(res, { ok: true });
  }),
);
