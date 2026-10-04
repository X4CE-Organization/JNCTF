import type { Challenge, ScoringType } from '@prisma/client';

/**
 * 分值计算。
 *
 * STATIC  —— 题目写死多少分就是多少分
 * DYNAMIC —— 解得人越多分越低，在 max 与 min 之间按平方曲线衰减：
 *
 *              value = max - (max - min) * (solves / decay)²
 *
 *           decay 是「衰减到最低分大约需要多少人解出」。solves 超过 decay 后就按 min 算。
 *           这是 CTF 圈最常用的动态分公式，解出人数少的时候分高，多了以后趋于保底分。
 */
export function challengeValue(
  challenge: Pick<Challenge, 'scoringType' | 'score' | 'minScore' | 'decay'>,
  solveCount: number,
): number {
  if (challenge.scoringType === 'STATIC') {
    return challenge.score;
  }
  const max = challenge.score;
  const min = Math.max(0, Math.min(challenge.minScore, max));
  const decay = Math.max(1, challenge.decay);
  if (solveCount <= 0) return max;
  const ratio = Math.min(1, solveCount / decay);
  const value = max - (max - min) * ratio * ratio;
  return Math.max(min, Math.round(value));
}

/** 一血 / 二血 / 三血加成，默认按百分比；返回额外加的分 */
export function bloodBonus(
  base: number,
  rank: number,
  bonuses: { first: number; second: number; third: number } = { first: 5, second: 3, third: 1 },
): number {
  if (rank === 1) return Math.round((base * bonuses.first) / 100);
  if (rank === 2) return Math.round((base * bonuses.second) / 100);
  if (rank === 3) return Math.round((base * bonuses.third) / 100);
  return 0;
}

/**
 * 比赛内排名用的排序：分高的在前，同分时「最后解出时间早」的在前，
 * 再相同则按 id 稳定排序。
 */
export interface Rankable {
  score: number;
  lastSolveAt: number | null;
  id: number | bigint;
}

function idOf(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

export function compareRanking(a: Rankable, b: Rankable): number {
  if (b.score !== a.score) return b.score - a.score;
  const aTime = a.lastSolveAt ?? Number.MAX_SAFE_INTEGER;
  const bTime = b.lastSolveAt ?? Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return idOf(a.id) - idOf(b.id);
}

/** 给一组条目算名次（并列同名次，后面跳号） */
export function assignRanks<T extends Rankable>(items: T[]): Array<T & { rank: number }> {
  const sorted = [...items].sort(compareRanking);
  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((item, index) => {
    const rank = lastScore !== null && item.score === lastScore ? lastRank : index + 1;
    lastScore = item.score;
    lastRank = rank;
    return { ...item, rank };
  });
}

export function scoringLabel(type: ScoringType): string {
  return type === 'DYNAMIC' ? '动态分值' : '固定分值';
}
