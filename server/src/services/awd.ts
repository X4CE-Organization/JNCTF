import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { renderFlagTemplate } from './judge.js';
import { notify, notifyMany } from '../lib/audit.js';
import { dockerAvailable, startAwxTarget, writeFlagIntoContainer, stopAwxTarget } from './awx-docker.js';
import { ApiError } from '../lib/errors.js';

/**
 * AWD（Attack With Defense）引擎。
 *
 * 一局 AWD 的完整循环：
 *   1. 开赛时给每支队伍每个服务起一台靶机，写入第一回合的 flag
 *   2. 每回合开始时轮换 flag（旧 flag 立即作废），并把新 flag 写进容器
 *   3. 回合中：别的队伍拿到你的 flag 并提交 → 攻方加分、守方扣分
 *   4. 回合结束时跑 checker 检查服务可用性 → 正常加分、挂掉扣分
 *   5. 结算本回合分数，进入下一回合
 *
 * 分数构成：基础存活分 + 攻击得分 - 被攻破扣分 + 服务可用性分
 */

/* ------------------------------------------------------------ 回合调度 */

/** 给一场比赛生成全部回合（开赛前调用一次即可，幂等） */
export async function generateRounds(competitionId: bigint): Promise<number> {
  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  if (!competition) throw ApiError.notFound('比赛不存在');
  if (competition.type === 'JEOPARDY') throw ApiError.badRequest('解题赛不需要生成 AWD 回合');

  const existing = await prisma.awxRound.count({ where: { competitionId } });
  if (existing > 0) return existing;

  const roundSeconds = Math.max(60, competition.awdRoundSeconds);
  const totalSeconds = competition.endAt.getTime() - competition.startAt.getTime();
  const roundCount = Math.max(1, Math.floor(totalSeconds / (roundSeconds * 1000)));

  const data = Array.from({ length: roundCount }, (_, index) => ({
    competitionId,
    roundNo: index + 1,
    startAt: new Date(competition.startAt.getTime() + index * roundSeconds * 1000),
    endAt: new Date(competition.startAt.getTime() + (index + 1) * roundSeconds * 1000),
    state: 'PENDING' as const,
  }));
  await prisma.awxRound.createMany({ data });
  logger.info({ competitionId, roundCount }, '已生成 AWD 回合');
  return roundCount;
}

/** 取当前应该处于进行中的回合 */
export async function currentRound(competitionId: bigint) {
  const now = new Date();
  return prisma.awxRound.findFirst({
    where: { competitionId, startAt: { lte: now }, endAt: { gt: now } },
    orderBy: { roundNo: 'asc' },
  });
}

/** 开赛：给每支参赛队伍每个服务准备靶机 */
export async function prepareTargets(competitionId: bigint): Promise<{ created: number; failed: number }> {
  const services = await prisma.awxService.findMany({ where: { competitionId } });
  if (!services.length) throw ApiError.badRequest('还没有配置 AWD 服务');

  const participants = await prisma.competitionParticipant.findMany({
    where: { competitionId, status: 'APPROVED', teamId: { not: null } },
    select: { teamId: true },
  });
  const teamIds = [...new Set(participants.map((p) => p.teamId).filter((id): id is bigint => id !== null))];
  if (!teamIds.length) throw ApiError.badRequest('还没有队伍报名');

  let created = 0;
  let failed = 0;
  for (const service of services) {
    for (const teamId of teamIds) {
      const existing = await prisma.awxTarget.findUnique({
        where: { awxServiceId_teamId: { awxServiceId: service.id, teamId } },
      });
      if (existing) continue;
      const target = await prisma.awxTarget.create({
        data: { competitionId, awxServiceId: service.id, teamId, status: 'CREATING' },
      });
      const ok = await startAwxTarget(target, service);
      ok ? created++ : failed++;
    }
  }
  logger.info({ competitionId, created, failed }, 'AWD 靶机准备完成');
  return { created, failed };
}

/* ---------------------------------------------------------- flag 轮换 */

/**
 * 开始一个新回合：轮换所有靶机的 flag 并写入容器。
 * 返回本轮下发的 flag 数量。
 */
export async function startRound(roundId: bigint): Promise<number> {
  const round = await prisma.awxRound.findUnique({ where: { id: roundId } });
  if (!round) throw ApiError.notFound('回合不存在');
  if (round.state === 'RUNNING' || round.settled) return 0;

  // 上一回合的 flag 全部作废
  await prisma.awxFlag.updateMany({ where: { competitionId: round.competitionId, expired: false }, data: { expired: true } });

  const services = await prisma.awxService.findMany({ where: { competitionId: round.competitionId } });
  const serviceMap = new Map(services.map((s) => [String(s.id), s]));
  const targets = await prisma.awxTarget.findMany({ where: { competitionId: round.competitionId } });

  let issued = 0;
  for (const target of targets) {
    const service = serviceMap.get(String(target.awxServiceId));
    if (!service) continue;
    const flag = renderFlagTemplate(service.flagTemplate, {
      team: target.teamId,
      round: round.roundNo,
    });
    await prisma.$transaction([
      prisma.awxFlag.create({
        data: {
          roundId: round.id,
          competitionId: round.competitionId,
          targetId: target.id,
          teamId: target.teamId,
          flag,
        },
      }),
      prisma.awxTarget.update({ where: { id: target.id }, data: { currentFlag: flag } }),
    ]);
    await writeFlagIntoContainer(target, service, flag);
    issued++;
  }

  await prisma.awxRound.update({ where: { id: round.id }, data: { state: 'RUNNING' } });
  await notifyMany(
    (
      await prisma.competitionParticipant.findMany({
        where: { competitionId: round.competitionId, status: 'APPROVED' },
        select: { userId: true },
      })
    ).map((p) => p.userId),
    'AWD',
    `第 ${round.roundNo} 回合开始`,
    `${issued} 个服务的 flag 已更新，记得去检查自己的靶机`,
  );
  logger.info({ roundId, roundNo: round.roundNo, issued }, 'AWD 回合开始');
  return issued;
}

/* -------------------------------------------------------------- 攻击 */

export interface AttackResult {
  success: boolean;
  message: string;
  attackerDelta?: number;
  victimDelta?: number;
}

/**
 * 提交别人的 flag。
 * 必须满足：flag 属于本轮、不属于自己队、本轮还没被同一队拿过。
 */
export async function submitAttack(
  competitionId: bigint,
  attackerTeamId: bigint,
  attackerUserId: bigint,
  submittedFlag: string,
): Promise<AttackResult> {
  const flag = submittedFlag.trim();
  if (!flag) return { success: false, message: 'flag 不能为空' };

  const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
  if (!competition) throw ApiError.notFound('比赛不存在');
  const round = await currentRound(competitionId);
  if (!round) return { success: false, message: '当前没有进行中的回合' };

  const record = await prisma.awxFlag.findUnique({ where: { flag } });
  if (!record || record.expired || record.roundId !== round.id) {
    return { success: false, message: 'flag 无效或已过期' };
  }
  if (record.teamId === attackerTeamId) {
    return { success: false, message: '不能提交自己队伍的 flag' };
  }

  // 同一队对同一个靶机，一回合只能拿一次分
  const repeated = await prisma.awxAttack.findFirst({
    where: { roundId: round.id, attackerTeamId, victimTargetId: record.targetId },
  });
  if (repeated) return { success: false, message: '这个 flag 本回合已经提交过了' };

  const attackScore = Math.max(0, competition.awdAttackScore);
  const penalty = Math.max(0, competition.awdDefensePenalty);

  await prisma.$transaction([
    prisma.awxAttack.create({
      data: {
        roundId: round.id,
        competitionId,
        attackerTeamId,
        attackerUserId,
        victimTargetId: record.targetId,
        victimTeamId: record.teamId,
        awxServiceId: (await prisma.awxTarget.findUnique({ where: { id: record.targetId } }))!.awxServiceId,
        flag,
        attackerDelta: attackScore,
        victimDelta: -penalty,
      },
    }),
    prisma.team.update({ where: { id: attackerTeamId }, data: { score: { increment: attackScore } } }),
    prisma.team.update({ where: { id: record.teamId }, data: { score: { decrement: penalty } } }),
    prisma.awxFlag.update({ where: { id: record.id }, data: { capturedCount: { increment: 1 } } }),
  ]);

  await notifyMany(
    (
      await prisma.teamMember.findMany({ where: { teamId: record.teamId }, select: { userId: true } })
    ).map((m) => m.userId),
    'AWD',
    '你的服务被攻破了',
    `第 ${round.roundNo} 回合，有队伍拿到了你们的 flag，扣 ${penalty} 分`,
  );

  return {
    success: true,
    message: `攻击成功！+${attackScore} 分，对方 -${penalty} 分`,
    attackerDelta: attackScore,
    victimDelta: -penalty,
  };
}

/* ------------------------------------------------------------- checker */

/**
 * 跑一轮可用性检查。每个靶机检查一次，通了加基础分，挂了扣分并累计失败次数。
 */
export async function runCheckers(roundId: bigint): Promise<{ passed: number; failed: number }> {
  const round = await prisma.awxRound.findUnique({ where: { id: roundId } });
  if (!round) return { passed: 0, failed: 0 };

  const targets = await prisma.awxTarget.findMany({
    where: { competitionId: round.competitionId, status: 'RUNNING' },
    include: { awxService: true },
  });

  let passed = 0;
  let failed = 0;
  for (const target of targets) {
    const started = Date.now();
    const result = await checkTarget(target.host, target.port, target.awxService.checkPath);
    // 服务可用加基础分；挂掉按固定值扣分（默认 10，可用服务自身的 baseScore 调整）
    const downPenalty = 10;
    const delta = result.ok ? Math.max(0, target.awxService.baseScore) : -downPenalty;

    await prisma.$transaction([
      prisma.awxCheck.create({
        data: {
          roundId: round.id,
          competitionId: round.competitionId,
          awxServiceId: target.awxServiceId,
          teamId: target.teamId,
          passed: result.ok,
          delta,
          message: result.message,
          durationMs: Date.now() - started,
        },
      }),
      prisma.awxTarget.update({
        where: { id: target.id },
        data: {
          alive: result.ok,
          failStreak: result.ok ? 0 : { increment: 1 },
        },
      }),
      prisma.team.update({ where: { id: target.teamId }, data: { score: { increment: delta } } }),
    ]);
    result.ok ? passed++ : failed++;
  }
  logger.info({ roundId, passed, failed }, 'AWD checker 执行完毕');
  return { passed, failed };
}

async function checkTarget(host: string | null, port: number | null, checkPath: string | null): Promise<{ ok: boolean; message: string }> {
  if (!host || !port) return { ok: false, message: '靶机没有分配地址' };
  const timeout = 3000;
  if (checkPath) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(`http://${host}:${port}${checkPath}`, { signal: controller.signal });
      clearTimeout(timer);
      return response.ok ? { ok: true, message: `HTTP ${response.status}` } : { ok: false, message: `HTTP ${response.status}` };
    } catch (err) {
      return { ok: false, message: (err as Error).message.slice(0, 200) };
    }
  }
  // 没配检查路径就只探 TCP 端口
  const net = await import('node:net');
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout });
    socket.on('connect', () => {
      socket.destroy();
      resolve({ ok: true, message: '端口可达' });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, message: '连接超时' });
    });
    socket.on('error', (err) => resolve({ ok: false, message: err.message.slice(0, 200) }));
  });
}

/* -------------------------------------------------------------- 结算 */

/** 结束一回合：跑 checker、结算、把回合标记为已结算 */
export async function settleRound(roundId: bigint): Promise<{ passed: number; failed: number }> {
  const round = await prisma.awxRound.findUnique({ where: { id: roundId } });
  if (!round || round.settled) return { passed: 0, failed: 0 };

  const result = await runCheckers(roundId);
  await prisma.awxRound.update({
    where: { id: roundId },
    data: { state: 'SETTLED', settled: true },
  });
  return result;
}

/* -------------------------------------------------------------- 榜单 */

export interface AwxScoreboardEntry {
  rank: number;
  teamId: bigint;
  teamName: string;
  avatar: string;
  score: number;
  attackScore: number;
  defensePenalty: number;
  aliveServices: number;
  totalServices: number;
  capturedFlags: number;
  lostFlags: number;
}

export async function awxScoreboard(competitionId: bigint): Promise<AwxScoreboardEntry[]> {
  const teams = await prisma.team.findMany({
    where: { awxTargets: { some: { competitionId } } },
    select: { id: true, name: true, avatar: true, score: true },
  });
  const [attacks, targets] = await Promise.all([
    prisma.awxAttack.findMany({ where: { competitionId }, select: { attackerTeamId: true, victimTeamId: true, attackerDelta: true, victimDelta: true } }),
    prisma.awxTarget.findMany({ where: { competitionId }, select: { teamId: true, alive: true } }),
  ]);

  const entries: AwxScoreboardEntry[] = teams.map((team) => {
    const key = String(team.id);
    const attacked = attacks.filter((a) => String(a.attackerTeamId) === key);
    const victim = attacks.filter((a) => String(a.victimTeamId) === key);
    const own = targets.filter((t) => String(t.teamId) === key);
    return {
      rank: 0,
      teamId: team.id,
      teamName: team.name,
      avatar: team.avatar ?? '',
      score: team.score,
      attackScore: attacked.reduce((sum, a) => sum + a.attackerDelta, 0),
      defensePenalty: victim.reduce((sum, a) => sum + Math.abs(a.victimDelta), 0),
      aliveServices: own.filter((t) => t.alive).length,
      totalServices: own.length,
      capturedFlags: attacked.length,
      lostFlags: victim.length,
    };
  });

  entries.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.teamId < b.teamId ? -1 : 1));
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  return entries;
}

/* ------------------------------------------------------------ 回合驱动 */

/**
 * 调度器每分钟调一次：
 *   - 到点的回合自动开始
 *   - 结束的回合自动结算
 *   - 比赛结束后清理靶机
 */
export async function tickAwx(now = new Date()): Promise<void> {
  const competitions = await prisma.competition.findMany({
    where: { type: { in: ['AWD', 'MIXED'] }, published: true, startAt: { lte: now }, endAt: { gt: new Date(now.getTime() - 3600_000) } },
  });

  for (const competition of competitions) {
    const rounds = await prisma.awxRound.findMany({
      where: { competitionId: competition.id },
      orderBy: { roundNo: 'asc' },
    });
    for (const round of rounds) {
      if (round.state === 'PENDING' && round.startAt <= now && round.endAt > now) {
        await startRound(round.id);
      } else if (round.state === 'RUNNING' && round.endAt <= now) {
        await settleRound(round.id);
      }
    }
    // 比赛结束后回收靶机
    if (competition.endAt <= now) {
      const alive = await prisma.awxTarget.findMany({
        where: { competitionId: competition.id, status: 'RUNNING' },
        include: { awxService: true },
      });
      for (const target of alive) await stopAwxTarget(target);
    }
  }
}

export { dockerAvailable };
