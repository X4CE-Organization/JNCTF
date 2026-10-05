import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, ok } from '../lib/errors.js';
import { buildScoreboard, buildTeamScoreboard } from '../services/scoreboard.js';
import { getBool } from '../lib/settings.js';

export const scoreboardRouter = Router();

/** 全站榜单：个人 / 团队，支持分页与只取前 N */
scoreboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const type = String(req.query.type ?? 'user');
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const competitionId = req.query.competitionId ? BigInt(String(req.query.competitionId)) : 0n;

    const items =
      type === 'team'
        // 队伍没有等级分，团队榜仍按比赛总分排
        ? await buildTeamScoreboard({ competitionId, limit })
        // 个人榜固定按等级分排名，不提供其它排序方式
        : await buildScoreboard({ competitionId, limit });

    return ok(res, {
      type,
      competitionId,
      sort: type === 'team' ? 'score' : 'rating',
      generatedAt: new Date().toISOString(),
      items: items.map((entry) => ({
        rank: entry.rank,
        id: entry.id,
        name: entry.name,
        avatar: entry.avatar,
        rating: entry.rating,
        solveCount: entry.solveCount,
        lastSolveAt: entry.lastSolveAt ? new Date(entry.lastSolveAt) : null,
        byCategory: entry.byCategory,
      })),
    });
  }),
);

/** 榜单顶部统计：参赛人数、题目数、解题总数 */
scoreboardRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [users, teams, challenges, solves, competitions] = await Promise.all([
      prisma.user.count({ where: { hidden: false, banned: false } }),
      prisma.team.count({ where: { hidden: false, banned: false } }),
      prisma.challenge.count({ where: { state: 'VISIBLE' } }),
      prisma.solve.count(),
      prisma.competition.count({ where: { published: true } }),
    ]);
    return ok(res, { users, teams, challenges, solves, competitions });
  }),
);

/** 最近的一血，首页展示用 */
scoreboardRouter.get(
  '/bloods',
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const rows = await prisma.solve.findMany({
      where: { firstBlood: true },
      include: {
        challenge: { select: { id: true, title: true } },
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return ok(res, {
      items: rows.map((s) => ({
        id: s.id,
        challenge: { id: s.challenge.id, title: s.challenge.title },
        user: { id: s.user.id, username: s.user.username, displayName: s.user.displayName || s.user.username, avatar: s.user.avatar },
        score: s.score,
        createdAt: s.createdAt,
      })),
    });
  }),
);

/** 题目按分类的解题分布，前端画雷达图/柱状图用 */
scoreboardRouter.get(
  '/breakdown',
  asyncHandler(async (req, res) => {
    const competitionId = req.query.competitionId ? BigInt(String(req.query.competitionId)) : 0n;
    const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
    const result = [];
    for (const category of categories) {
      const [challenges, solves] = await Promise.all([
        prisma.challenge.count({ where: { categoryId: category.id, state: 'VISIBLE' } }),
        prisma.solve.count({ where: { competitionId, challenge: { categoryId: category.id } } }),
      ]);
      result.push({ id: category.id, name: category.name, color: category.color, challenges, solves });
    }
    return ok(res, { items: result });
  }),
);

export { getBool };
