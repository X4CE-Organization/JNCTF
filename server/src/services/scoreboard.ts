import { prisma } from '../lib/prisma.js';
import { assignRanks } from './scoring.js';

export interface ScoreboardEntry {
  id: bigint;
  name: string;
  avatar: string;
  score: number;
  solveCount: number;
  lastSolveAt: number | null;
  rank: number;
  /** 该条目每道题的解出时间，前端画时间线用 */
  timeline: Array<{ challengeId: bigint; at: number; score: number }>;
  /** 按分类统计的解题数 */
  byCategory: Record<string, number>;
}

export interface ScoreboardOptions {
  competitionId?: bigint | null;
  /** 只看这几个用户的提交（比赛用） */
  userIds?: bigint[];
  /** 封榜时间：这个时间之后的解题不计入 */
  freezeAt?: Date | null;
  limit?: number;
  includeHidden?: boolean;
}

/**
 * 榜单计算。
 *
 * 只有「比赛榜」和「总榜」两个维度：
 *   - competitionId 传具体比赛 → 算那场比赛的分
 *   - 传 0 或不传 → 算练习模式（比赛外解出的题）
 *   - competitionId 传 null 且 groupBy=team → 全站团队总榜
 */
export async function buildScoreboard(options: ScoreboardOptions = {}): Promise<ScoreboardEntry[]> {
  const { userIds, freezeAt, limit = 200, includeHidden = false } = options;
  const competitionId = options.competitionId ?? 0n;

  const solves = await prisma.solve.findMany({
    where: {
      competitionId,
      ...(userIds?.length ? { userId: { in: userIds } } : {}),
      ...(freezeAt ? { createdAt: { lt: freezeAt } } : {}),
    },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatar: true, hidden: true } },
      challenge: { select: { id: true, title: true, categoryId: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const categoryName = new Map(categories.map((c) => [String(c.id), c.name]));

  const buckets = new Map<string, ScoreboardEntry>();
  for (const solve of solves) {
    if (!includeHidden && solve.user.hidden) continue;
    const key = String(solve.userId);
    let entry = buckets.get(key);
    if (!entry) {
      entry = {
        id: solve.userId,
        name: solve.user.displayName || solve.user.username,
        avatar: solve.user.avatar ?? '',
        score: 0,
        solveCount: 0,
        lastSolveAt: null,
        rank: 0,
        timeline: [],
        byCategory: {},
      };
      buckets.set(key, entry);
    }
    entry.score += solve.score;
    entry.solveCount += 1;
    const at = solve.createdAt.getTime();
    entry.lastSolveAt = entry.lastSolveAt === null ? at : Math.max(entry.lastSolveAt, at);
    entry.timeline.push({ challengeId: solve.challengeId, at, score: solve.score });
    const catName = solve.challenge.categoryId ? categoryName.get(String(solve.challenge.categoryId)) : undefined;
    if (catName) entry.byCategory[catName] = (entry.byCategory[catName] ?? 0) + 1;
  }

  return assignRanks([...buckets.values()]).slice(0, limit);
}

/** 团队榜：把队员的解题合并到队伍头上 */
export async function buildTeamScoreboard(options: ScoreboardOptions = {}): Promise<ScoreboardEntry[]> {
  const { freezeAt, limit = 200, includeHidden = false } = options;
  const competitionId = options.competitionId ?? 0n;

  const solves = await prisma.solve.findMany({
    where: {
      competitionId,
      teamId: { not: null },
      ...(freezeAt ? { createdAt: { lt: freezeAt } } : {}),
    },
    include: {
      team: { select: { id: true, name: true, avatar: true, hidden: true } },
      challenge: { select: { id: true, categoryId: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const categoryName = new Map(categories.map((c) => [String(c.id), c.name]));
  const buckets = new Map<string, ScoreboardEntry>();
  const seenChallenge = new Set<string>();

  for (const solve of solves) {
    const team = solve.team;
    if (!team || (!includeHidden && team.hidden)) continue;
    // 同一队同一题只算一次（不同队员重复解出不计）
    const dedupeKey = `${team.id}:${solve.challengeId}`;
    if (seenChallenge.has(dedupeKey)) continue;
    seenChallenge.add(dedupeKey);

    const key = String(team.id);
    let entry = buckets.get(key);
    if (!entry) {
      entry = {
        id: team.id,
        name: team.name,
        avatar: team.avatar ?? '',
        score: 0,
        solveCount: 0,
        lastSolveAt: null,
        rank: 0,
        timeline: [],
        byCategory: {},
      };
      buckets.set(key, entry);
    }
    entry.score += solve.score;
    entry.solveCount += 1;
    const at = solve.createdAt.getTime();
    entry.lastSolveAt = entry.lastSolveAt === null ? at : Math.max(entry.lastSolveAt, at);
    entry.timeline.push({ challengeId: solve.challengeId, at, score: solve.score });
    const catName = solve.challenge.categoryId ? categoryName.get(String(solve.challenge.categoryId)) : null;
    if (catName) entry.byCategory[catName] = (entry.byCategory[catName] ?? 0) + 1;
  }

  return assignRanks([...buckets.values()]).slice(0, limit);
}

/** 比赛结束后把选手分数写回参赛记录，省得每次现算 */
export async function freezeCompetitionScore(competitionId: bigint): Promise<number> {
  const entries = await buildScoreboard({ competitionId, includeHidden: true });
  let updated = 0;
  for (const entry of entries) {
    const result = await prisma.competitionParticipant.updateMany({
      where: { competitionId, userId: entry.id },
      data: { score: entry.score, lastSolveAt: entry.lastSolveAt ? new Date(entry.lastSolveAt) : null },
    });
    updated += result.count;
  }
  return updated;
}
