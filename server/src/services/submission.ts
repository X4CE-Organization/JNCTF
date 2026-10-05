import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/errors.js';
import { getBool, getInt, getSetting } from '../lib/settings.js';
import { addPoints, pointsPerFirstBlood, pointsPerSolve } from '../lib/points.js';
import { rateLimit } from '../lib/redis.js';
import { judgeFlag } from './judge.js';
import { bloodBonus, challengeValue } from './scoring.js';
import { notify, notifyMany } from '../lib/audit.js';
import type { AuthUser } from '../middleware/auth.js';

export interface SubmitInput {
  challengeId: bigint;
  flag: string;
  competitionId?: bigint | null;
  teamId?: bigint | null;
  ip?: string;
  userAgent?: string;
}

export interface SubmitResult {
  status: 'CORRECT' | 'WRONG' | 'DUPLICATE' | 'RATE_LIMITED' | 'CLOSED';
  score: number;
  message: string;
  solveId?: bigint;
  firstBlood?: boolean;
}

/**
 * 交 flag 的完整流程：校验 → 判分 → 计分 → 落库 → 通知。
 *
 * 顺序上刻意把「限流」放在参数校验之后，这样用户填错格式不会白白进冷却。
 */
export async function submitFlag(user: AuthUser, input: SubmitInput): Promise<SubmitResult> {
  const flag = input.flag.trim();
  if (!flag) throw ApiError.badRequest('flag 不能为空');
  if (flag.length > 512) throw ApiError.badRequest('flag 过长');

  const challenge = await prisma.challenge.findUnique({
    where: { id: input.challengeId },
    include: { flags: true },
  });
  if (!challenge) throw ApiError.notFound('题目不存在');
  if (challenge.state === 'HIDDEN' && user.role === 'USER') throw ApiError.notFound('题目不存在');
  if (challenge.state === 'CLOSED') {
    return { status: 'CLOSED', score: 0, message: '该题已关闭提交' };
  }

  // 比赛相关校验：必须在比赛时间窗内、且已报名
  let competitionId = input.competitionId ?? 0n;
  let competition: Awaited<ReturnType<typeof prisma.competition.findUnique>> = null;
  if (competitionId !== 0n) {
    competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw ApiError.notFound('比赛不存在');
    const now = Date.now();
    if (now < competition.startAt.getTime()) throw ApiError.forbidden('比赛还没开始');
    if (now > competition.endAt.getTime()) throw ApiError.forbidden('比赛已经结束');
    const inCompetition = await prisma.competitionChallenge.findUnique({
      where: { competitionId_challengeId: { competitionId, challengeId: challenge.id } },
    });
    if (!inCompetition) throw ApiError.badRequest('这道题不在该比赛中');
    const participant = await prisma.competitionParticipant.findUnique({
      where: { competitionId_userId: { competitionId, userId: user.id } },
    });
    if (!participant || participant.banned) throw ApiError.forbidden('你还没有参加这场比赛');
    if (participant.status !== 'APPROVED') throw ApiError.forbidden('参赛申请还在审核中');
  } else if (getSetting('challenge.practice_only_during_free') === 'true') {
    // 预留开关：只在没有进行中的比赛时允许练习
  }

  // 限流
  const interval = getInt('challenge.submit_interval_seconds') || 5;
  if (!(await rateLimit(`submit:${user.id}`, interval))) {
    throw ApiError.tooMany(`提交过于频繁，请 ${interval} 秒后再试`);
  }

  // 是否已经做出来过
  const teamId = input.teamId ?? null;
  const existing = await prisma.solve.findFirst({
    where: {
      challengeId: challenge.id,
      competitionId,
      OR: [{ userId: user.id }, ...(teamId ? [{ teamId }] : [])],
    },
  });
  if (existing) {
    await prisma.submission.create({
      data: {
        challengeId: challenge.id,
        userId: user.id,
        teamId,
        competitionId: competitionId === 0n ? null : competitionId,
        flag: flag.slice(0, 512),
        status: 'DUPLICATE',
        score: 0,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
    return { status: 'DUPLICATE', score: 0, message: '你已经解出这道题了' };
  }

  // 最大提交次数
  if (challenge.maxAttempts > 0) {
    const attempts = await prisma.submission.count({
      where: { challengeId: challenge.id, userId: user.id, status: 'WRONG' },
    });
    if (attempts >= challenge.maxAttempts) {
      return { status: 'RATE_LIMITED', score: 0, message: `该题最多只能提交 ${challenge.maxAttempts} 次错误答案` };
    }
  }

  // 动态题的实例 flag
  let dynamicFlag: string | null = null;
  if (challenge.requiresContainer) {
    const instance = await prisma.challengeInstance.findFirst({
      where: { challengeId: challenge.id, userId: user.id, status: 'RUNNING' },
      orderBy: { id: 'desc' },
    });
    dynamicFlag = instance?.instanceFlag ?? null;
  }

  const judged = judgeFlag(flag, challenge.flags, dynamicFlag);
  await prisma.challenge.update({
    where: { id: challenge.id },
    data: { attemptCount: { increment: 1 } },
  });

  if (!judged.correct) {
    await prisma.submission.create({
      data: {
        challengeId: challenge.id,
        userId: user.id,
        teamId,
        competitionId: competitionId === 0n ? null : competitionId,
        flag: flag.slice(0, 512),
        status: 'WRONG',
        score: 0,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
    return { status: 'WRONG', score: 0, message: 'flag 不正确' };
  }

  /* ---------------------------------------------------------- 答对了 */

  const solveCount = await prisma.solve.count({
    where: { challengeId: challenge.id, competitionId },
  });
  const override = competition
    ? await prisma.competitionChallenge.findUnique({
        where: { competitionId_challengeId: { competitionId, challengeId: challenge.id } },
        select: { customScore: true },
      })
    : null;
  const base = override?.customScore ?? challengeValue(challenge, solveCount);

  const rank = solveCount + 1;
  const bonus = competition ? bloodBonus(base, rank) : 0;
  const score = base + bonus;
  const now = new Date();
  const solveSeconds = competition
    ? Math.max(0, Math.floor((now.getTime() - competition.startAt.getTime()) / 1000))
    : null;

  const [solve] = await prisma.$transaction([
    prisma.solve.create({
      data: {
        challengeId: challenge.id,
        userId: user.id,
        teamId,
        competitionId,
        score,
        firstBlood: rank === 1,
        secondBlood: rank === 2,
        thirdBlood: rank === 3,
        solveSeconds: solveSeconds === null ? null : BigInt(solveSeconds),
        createdAt: now,
      },
    }),
    prisma.submission.create({
      data: {
        challengeId: challenge.id,
        userId: user.id,
        teamId,
        competitionId: competitionId === 0n ? null : competitionId,
        flag: flag.slice(0, 512),
        status: 'CORRECT',
        score,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    }),
    prisma.challenge.update({
      where: { id: challenge.id },
      data: { solveCount: { increment: 1 } },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { score: { increment: score } },
    }),
  ]);

  const balance = (await prisma.user.findUnique({ where: { id: user.id }, select: { score: true } }))?.score ?? 0;
  await prisma.pointLog.create({
    data: {
      userId: user.id,
      delta: score,
      balance,
      reason: `解出「${challenge.title}」`,
      refType: 'challenge',
      refId: challenge.id,
    },
  });

  // 积分（商店货币）和等级分分开记：做一题给固定积分，一血再多给一点
  if (getBool('points.enabled')) {
    const gain = pointsPerSolve() + (rank === 1 ? pointsPerFirstBlood() : 0);
    if (gain > 0) {
      await addPoints(user.id, gain, `解出「${challenge.title}」`, { refType: 'challenge', refId: challenge.id }).catch(() => null);
    }
  }

  if (teamId) {
    await prisma.team.update({ where: { id: teamId }, data: { score: { increment: score } } });
  }
  if (competitionId !== 0n) {
    await prisma.competitionParticipant.updateMany({
      where: { competitionId, userId: user.id },
      data: { score: { increment: score }, lastSolveAt: now },
    });
  }

  // 一血通知全站，二三血只通知出题人
  if (rank === 1) {
    await notify(user.id, 'ACHIEVEMENT', `一血！${challenge.title}`, `你是第一个解出这道题的人，得分 ${score}`);
  }
  if (challenge.authorId && challenge.authorId !== user.id) {
    await notify(challenge.authorId, 'SYSTEM', `「${challenge.title}」被解出`, `${user.username} 第 ${rank} 个解出`);
  }

  return {
    status: 'CORRECT',
    score,
    solveId: solve.id,
    firstBlood: rank === 1,
    message: rank === 1 ? `一血！+${score} 分` : `回答正确，+${score} 分`,
  };
}

/** 给动态题起容器失败时用：直接把 flag 下发（不推荐，仅调试） */
export async function revealDynamicFlag(challengeId: bigint, userId: bigint): Promise<string | null> {
  const instance = await prisma.challengeInstance.findFirst({
    where: { challengeId, userId, status: 'RUNNING' },
    orderBy: { id: 'desc' },
  });
  return instance?.instanceFlag ?? null;
}

export { notifyMany };
