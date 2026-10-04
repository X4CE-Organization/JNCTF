import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { optionalUser, requireAuth } from '../middleware/auth.js';
import { audit, notify } from '../lib/audit.js';
import { buildScoreboard, buildTeamScoreboard } from '../services/scoreboard.js';
import { challengeValue } from '../services/scoring.js';

export const competitionRouter = Router();

/** 比赛当前状态按时间轴实时判断，不依赖数据库里的 state 字段 */
export function liveState(c: { startAt: Date; endAt: Date; freezeAt: Date | null }): string {
  const now = Date.now();
  if (now < c.startAt.getTime()) return 'UPCOMING';
  if (now > c.endAt.getTime()) return 'ENDED';
  if (c.freezeAt && now >= c.freezeAt.getTime()) return 'FROZEN';
  return 'RUNNING';
}

function shapeCompetition(c: any, participant?: { status: string; teamId: bigint | null } | null) {
  return {
    id: c.id,
    name: c.name,
    subtitle: c.subtitle ?? '',
    slug: c.slug,
    description: c.description ?? '',
    rules: c.rules ?? '',
    banner: c.banner ?? '',
    type: c.type,
    state: c.state,
    status: liveState(c),
    teamMode: c.teamMode,
    startAt: c.startAt,
    endAt: c.endAt,
    freezeAt: c.freezeAt,
    minTeamSize: c.minTeamSize,
    maxTeamSize: c.maxTeamSize,
    needApproval: c.needApproval,
    hideScoreboard: c.hideScoreboard,
    hideChallenges: c.hideChallenges,
    practiceAfter: c.practiceAfter,
    participantCount: c._count?.participants,
    challengeCount: c._count?.challenges,
    joined: Boolean(participant),
    participantStatus: participant?.status ?? null,
  };
}

/* ---------------------------------------------------------------- 列表 */

competitionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(50, Math.max(1, Number(req.query.size) || 12));
    const keyword = String(req.query.keyword ?? '').trim();
    const type = String(req.query.type ?? '').trim();

    const where: any = { published: true };
    if (keyword) where.name = { contains: keyword, mode: 'insensitive' };
    if (type) where.type = type;

    const [total, rows] = await Promise.all([
      prisma.competition.count({ where }),
      prisma.competition.findMany({
        where,
        include: { _count: { select: { participants: true, challenges: true } } },
        orderBy: [{ startAt: 'desc' }],
        skip: (page - 1) * size,
        take: size,
      }),
    ]);

    const joined = viewer
      ? await prisma.competitionParticipant.findMany({
          where: { userId: viewer.id },
          select: { competitionId: true, status: true, teamId: true },
        })
      : [];
    const joinedMap = new Map(joined.map((j) => [String(j.competitionId), j]));

    return ok(res, {
      items: rows.map((c) => shapeCompetition(c, joinedMap.get(String(c.id)) ?? null)),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

/* ---------------------------------------------------------------- 我的 */

competitionRouter.get(
  '/mine/list',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const rows = await prisma.competitionParticipant.findMany({
      where: { userId: user.id },
      include: { competition: { include: { _count: { select: { participants: true, challenges: true } } } } },
      orderBy: { registeredAt: 'desc' },
    });
    return ok(res, {
      items: rows.map((p) => ({
        ...shapeCompetition(p.competition, { status: p.status, teamId: p.teamId }),
        myScore: p.score,
      })),
    });
  }),
);

/* ---------------------------------------------------------------- 详情 */

competitionRouter.get(
  '/:idOrSlug',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const key = req.params.idOrSlug!;
    const include = { _count: { select: { participants: true, challenges: true } } };
    const competition = /^\d+$/.test(key)
      ? await prisma.competition.findUnique({ where: { id: BigInt(key) }, include })
      : await prisma.competition.findUnique({ where: { slug: key }, include });
    if (!competition) throw ApiError.notFound('比赛不存在');
    if (!competition.published && (!viewer || viewer.role === 'USER')) throw ApiError.notFound('比赛不存在');

    const participant = viewer
      ? await prisma.competitionParticipant.findUnique({
          where: { competitionId_userId: { competitionId: competition.id, userId: viewer.id } },
        })
      : null;
    const announcements = await prisma.competitionAnnouncement.findMany({
      where: { competitionId: competition.id },
      orderBy: { id: 'desc' },
      take: 20,
    });
    return ok(res, {
      ...shapeCompetition(competition, participant),
      announcements: announcements.map((a) => ({ id: a.id, title: a.title, content: a.content, createdAt: a.createdAt })),
      teamId: participant?.teamId ?? null,
    });
  }),
);

/* ---------------------------------------------------------------- 报名 */

competitionRouter.post(
  '/:id/register',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const competition = await prisma.competition.findUnique({ where: { id: BigInt(req.params.id!) } });
    if (!competition) throw ApiError.notFound('比赛不存在');
    if (!competition.published) throw ApiError.forbidden('比赛尚未开放');
    if (Date.now() > competition.endAt.getTime()) throw ApiError.forbidden('比赛已经结束');

    const password = String(req.body?.password ?? '');
    if (competition.joinPassword && competition.joinPassword !== password) {
      throw ApiError.forbidden('参赛口令不正确');
    }

    const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
    if (competition.teamMode === 'TEAM' && !membership) throw ApiError.badRequest('这场比赛需要先组队');
    if (membership) {
      const size = await prisma.teamMember.count({ where: { teamId: membership.teamId } });
      if (size < competition.minTeamSize) throw ApiError.badRequest(`队伍人数不足，至少需要 ${competition.minTeamSize} 人`);
      if (size > competition.maxTeamSize) throw ApiError.badRequest(`队伍人数超出上限 ${competition.maxTeamSize} 人`);
    }
    if (competition.maxParticipants > 0) {
      const count = await prisma.competitionParticipant.count({
        where: { competitionId: competition.id, status: 'APPROVED' },
      });
      if (count >= competition.maxParticipants) throw ApiError.badRequest('报名人数已满');
    }

    const existing = await prisma.competitionParticipant.findUnique({
      where: { competitionId_userId: { competitionId: competition.id, userId: user.id } },
    });
    if (existing) throw ApiError.badRequest('你已经报名了这场比赛');

    const status = competition.needApproval ? 'PENDING' : 'APPROVED';
    await prisma.competitionParticipant.create({
      data: { competitionId: competition.id, userId: user.id, teamId: membership?.teamId ?? null, status },
    });
    await notify(
      user.id,
      'COMPETITION',
      status === 'PENDING' ? `已提交「${competition.name}」的参赛申请` : `已成功报名「${competition.name}」`,
      status === 'PENDING' ? '等待管理员审核' : '比赛开始后即可答题',
      `/competitions/${competition.slug}`,
    );
    await audit(req, user, 'competition.register', 'competition', competition.id);
    return ok(res, { ok: true, status });
  }),
);

competitionRouter.post(
  '/:id/unregister',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const competition = await prisma.competition.findUnique({ where: { id: BigInt(req.params.id!) } });
    if (!competition) throw ApiError.notFound('比赛不存在');
    const status = liveState(competition);
    if (status === 'RUNNING' || status === 'FROZEN') throw ApiError.forbidden('比赛进行中不能取消报名');
    await prisma.competitionParticipant.deleteMany({ where: { competitionId: competition.id, userId: user.id } });
    return ok(res, { ok: true });
  }),
);

/* ------------------------------------------------------------ 比赛题目 */

competitionRouter.get(
  '/:id/challenges',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const competition = await prisma.competition.findUnique({ where: { id: BigInt(req.params.id!) } });
    if (!competition) throw ApiError.notFound('比赛不存在');
    const status = liveState(competition);
    const isStaff = Boolean(viewer && viewer.role !== 'USER');
    if (competition.hideChallenges && status === 'UPCOMING' && !isStaff) {
      return ok(res, { items: [], hidden: true, status, startsIn: competition.startAt.getTime() - Date.now() });
    }

    const rows = await prisma.competitionChallenge.findMany({
      where: { competitionId: competition.id },
      include: { challenge: { include: { category: true, tags: { include: { tag: true } }, files: true, hints: true } } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    const solved = viewer
      ? new Set(
          (
            await prisma.solve.findMany({
              where: { userId: viewer.id, competitionId: competition.id },
              select: { challengeId: true },
            })
          ).map((s) => String(s.challengeId)),
        )
      : new Set<string>();
    const grouped = await prisma.solve.groupBy({
      by: ['challengeId'],
      where: { competitionId: competition.id },
      _count: { _all: true },
    });
    const solveCount = new Map(grouped.map((g) => [String(g.challengeId), g._count._all]));

    return ok(res, {
      status,
      hidden: false,
      items: rows.map((row) => {
        const c = row.challenge;
        const count = solveCount.get(String(c.id)) ?? 0;
        return {
          id: c.id,
          title: c.title,
          categoryId: c.categoryId,
          category: c.category ? { id: c.category.id, name: c.category.name, color: c.category.color } : null,
          difficulty: c.difficulty,
          score: row.customScore ?? c.score,
          currentValue: row.customScore ?? challengeValue(c, count),
          solveCount: count,
          tags: c.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
          fileCount: c.files.length,
          hintCount: c.hints.length,
          solved: solved.has(String(c.id)),
          requiresContainer: c.requiresContainer,
        };
      }),
    });
  }),
);

/* ------------------------------------------------------------ 比赛榜单 */

competitionRouter.get(
  '/:id/scoreboard',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const competition = await prisma.competition.findUnique({ where: { id: BigInt(req.params.id!) } });
    if (!competition) throw ApiError.notFound('比赛不存在');
    const status = liveState(competition);
    const isStaff = Boolean(viewer && viewer.role !== 'USER');

    if (competition.hideScoreboard && status === 'UPCOMING' && !isStaff) {
      return ok(res, { hidden: true, items: [], status });
    }

    // 封榜期间普通选手只能看到封榜那一刻的排名
    const frozen = status === 'FROZEN' && !isStaff;
    const defaultType = competition.teamMode === 'TEAM' ? 'team' : 'user';
    const type = competition.teamMode === 'SOLO' ? 'user' : String(req.query.type ?? defaultType);
    const options = {
      competitionId: competition.id,
      freezeAt: frozen ? competition.freezeAt : null,
      limit: 200,
      includeHidden: isStaff,
    };
    const items = type === 'team' ? await buildTeamScoreboard(options) : await buildScoreboard(options);

    return ok(res, {
      hidden: false,
      frozen,
      status,
      type,
      freezeAt: competition.freezeAt,
      notice: frozen ? '比赛已封榜，当前展示的是封榜时的排名' : '',
      items: items.map((entry) => ({
        rank: entry.rank,
        id: entry.id,
        name: entry.name,
        avatar: entry.avatar,
        score: entry.score,
        solveCount: entry.solveCount,
        lastSolveAt: entry.lastSolveAt ? new Date(entry.lastSolveAt) : null,
        timeline: entry.timeline.map((t) => ({ challengeId: t.challengeId, at: t.at, score: t.score })),
      })),
    });
  }),
);

/* ------------------------------------------------------------ 参赛名单 */

competitionRouter.get(
  '/:id/participants',
  asyncHandler(async (req, res) => {
    const rows = await prisma.competitionParticipant.findMany({
      where: { competitionId: BigInt(req.params.id!), status: 'APPROVED' },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
        team: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { score: 'desc' },
      take: 500,
    });
    return ok(res, {
      items: rows.map((p) => ({
        id: p.id,
        score: p.score,
        status: p.status,
        registeredAt: p.registeredAt,
        user: {
          id: p.user.id,
          username: p.user.username,
          displayName: p.user.displayName || p.user.username,
          avatar: p.user.avatar,
        },
        team: p.team ? { id: p.team.id, name: p.team.name, avatar: p.team.avatar } : null,
      })),
    });
  }),
);
