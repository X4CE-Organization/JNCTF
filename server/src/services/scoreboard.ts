import { prisma } from '../lib/prisma.js';
import { assignRanks } from './scoring.js';

export interface ScoreboardEntry {
  id: bigint;
  name: string;
  avatar: string;
  /** 总分：解出题目累加的分值，榜单排名默认按它 */
  score: number;
  /** 积分：商店货币，做一题 +1 */
  points: number;
  /** 等级分：初始 1500，只在比赛结算时变动 */
  rating: number;
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
        points: 0,
        rating: 1500,
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

  // 积分和等级分不进解题记录，单独从用户表取一次补上
  if (buckets.size) {
    const users = await prisma.user.findMany({
      where: { id: { in: [...buckets.keys()].map((key) => BigInt(key)) } },
      select: { id: true, points: true, rating: true },
    });
    for (const user of users) {
      const entry = buckets.get(String(user.id));
      if (entry) {
        entry.points = user.points;
        entry.rating = user.rating;
      }
    }
  }

  // 个人榜只认等级分；总分和积分都不参与排名
  return assignRanks([...buckets.values()], (entry) => entry.rating).slice(0, limit);
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
        // 队伍不单独记积分和等级分，榜单里只按总分排
        points: 0,
        rating: 0,
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
  await applyRatingChanges(competitionId, entries);
  return updated;
}

/** 榜单名次 → 等级分增减。参考常见 Elo 梯度：人数越多头名加得越多 */
export function ratingDelta(rank: number, total: number): number {
  if (total <= 1) return 5;
  const percentile = rank / total; // 0 越小越靠前
  if (percentile <= 0.01) return 60;
  if (percentile <= 0.05) return 40;
  if (percentile <= 0.15) return 25;
  if (percentile <= 0.35) return 10;
  if (percentile <= 0.6) return 0;
  if (percentile <= 0.85) return -10;
  return -20;
}

/**
 * 比赛结算时更新每个人的等级分。
 * 只按名次梯度算，和解题总分、积分互不影响；同一场比赛只结算一次。
 */
async function applyRatingChanges(competitionId: bigint, entries: ScoreboardEntry[]): Promise<void> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { ratingApplied: true, name: true },
  });
  if (!competition || competition.ratingApplied || entries.length === 0) return;

  const total = entries.length;
  for (const entry of entries) {
    const delta = ratingDelta(entry.rank, total);
    if (delta === 0) continue;
    const user = await prisma.user.findUnique({ where: { id: entry.id }, select: { rating: true } });
    if (!user) continue;
    const next = Math.max(0, user.rating + delta);
    await prisma.user.update({ where: { id: entry.id }, data: { rating: next } });
    await prisma.pointLog.create({
      data: {
        userId: entry.id,
        delta: 0,
        balance: 0,
        reason: `比赛「${competition.name}」第 ${entry.rank} 名，等级分 ${delta > 0 ? '+' : ''}${delta}`,
        refType: 'competition_rating',
        refId: competitionId,
      },
    });
  }
  await prisma.competition.update({ where: { id: competitionId }, data: { ratingApplied: true } });
}
