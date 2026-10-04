import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import {
  awxScoreboard,
  currentRound,
  prepareTargets,
  submitAttack,
  tickAwx,
} from '../services/awd.js';
import { awxDockerStats, dockerAvailable, startAwxTarget, stopAwxTarget } from '../services/awx-docker.js';

export const awdRouter = Router();

/** 我的靶机：列出一场比赛里自己队伍的所有服务实例 + 当前 flag */
awdRouter.get(
  '/competitions/:id/my-targets',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const competitionId = BigInt(req.params.id!);
    const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
    if (!membership) throw ApiError.badRequest('你需要先加入一支队伍');

    const round = await currentRound(competitionId);
    const targets = await prisma.awxTarget.findMany({
      where: { competitionId, teamId: membership.teamId },
      include: { awxService: true },
    });

    return ok(res, {
      round: round ? { id: round.id, roundNo: round.roundNo, startAt: round.startAt, endAt: round.endAt, state: round.state } : null,
      dockerEnabled: dockerAvailable(),
      items: targets.map((target) => ({
        id: target.id,
        serviceId: target.awxServiceId,
        serviceName: target.awxService.name,
        description: target.awxService.description ?? '',
        protocol: target.awxService.protocol,
        status: target.status,
        alive: target.alive,
        failStreak: target.failStreak,
        host: target.host,
        port: target.port,
        connection: target.host && target.port ? `${target.host}:${target.port}` : null,
        // 自己队伍的 flag 当然要能看到，方便自查
        flag: target.currentFlag,
        errorMessage: target.errorMessage,
      })),
    });
  }),
);

/** 提交别人的 flag */
awdRouter.post(
  '/competitions/:id/attack',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const competitionId = BigInt(req.params.id!);
    const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
    if (!membership) throw ApiError.badRequest('你需要先加入一支队伍');

    const result = await submitAttack(competitionId, membership.teamId, user.id, String(req.body?.flag ?? ''));
    if (result.success) {
      await audit(req, user, 'awd.attack', 'competition', competitionId, result.message);
    }
    return ok(res, result);
  }),
);

/** 某个服务被谁打过 / 我打过谁 */
awdRouter.get(
  '/competitions/:id/attacks',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const competitionId = BigInt(req.params.id!);
    const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
    const scope = String(req.query.scope ?? 'all');
    const isStaff = user.role !== 'USER';

    const where: any = { competitionId };
    if (!isStaff) {
      if (!membership) throw ApiError.badRequest('你需要先加入一支队伍');
      if (scope === 'attack') where.attackerTeamId = membership.teamId;
      else if (scope === 'defense') where.victimTeamId = membership.teamId;
      else where.OR = [{ attackerTeamId: membership.teamId }, { victimTeamId: membership.teamId }];
    }

    const rows = await prisma.awxAttack.findMany({
      where,
      include: {
        awxService: { select: { id: true, name: true } },
        target: { select: { id: true, teamId: true } },
        round: { select: { roundNo: true } },
        attacker: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { id: 'desc' },
      take: 200,
    });
    const teamIds = [...new Set(rows.flatMap((r) => [r.attackerTeamId, r.victimTeamId]))];
    const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } });
    const teamName = new Map(teams.map((t) => [String(t.id), t.name]));

    return ok(res, {
      items: rows.map((r) => ({
        id: r.id,
        roundNo: r.round.roundNo,
        service: r.awxService.name,
        attackerTeam: teamName.get(String(r.attackerTeamId)) ?? '未知队伍',
        victimTeam: teamName.get(String(r.victimTeamId)) ?? '未知队伍',
        attacker: r.attacker ? { username: r.attacker.username, displayName: r.attacker.displayName || r.attacker.username } : null,
        attackerDelta: r.attackerDelta,
        victimDelta: r.victimDelta,
        createdAt: r.createdAt,
      })),
    });
  }),
);

/** AWD 实时榜 */
awdRouter.get(
  '/competitions/:id/scoreboard',
  asyncHandler(async (req, res) => {
    const competitionId = BigInt(req.params.id!);
    const items = await awxScoreboard(competitionId);
    const round = await currentRound(competitionId);
    const rounds = await prisma.awxRound.findMany({
      where: { competitionId },
      orderBy: { roundNo: 'asc' },
      select: { id: true, roundNo: true, state: true, startAt: true, endAt: true },
    });
    return ok(res, { items, currentRound: round, rounds });
  }),
);

/** 每回合的检查结果（排查谁的服务挂了） */
awdRouter.get(
  '/competitions/:id/checks',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const competitionId = BigInt(req.params.id!);
    const where: any = { competitionId };
    if (user.role === 'USER') {
      const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
      if (!membership) return ok(res, { items: [] });
      where.teamId = membership.teamId;
    }
    const rows = await prisma.awxCheck.findMany({
      where,
      include: { awxService: { select: { name: true } }, round: { select: { roundNo: true } }, team: { select: { name: true } } },
      orderBy: { id: 'desc' },
      take: 200,
    });
    return ok(res, {
      items: rows.map((c) => ({
        id: c.id,
        roundNo: c.round.roundNo,
        service: c.awxService.name,
        team: c.team.name,
        passed: c.passed,
        delta: c.delta,
        message: c.message,
        durationMs: c.durationMs,
        createdAt: c.createdAt,
      })),
    });
  }),
);

/* ---------------------------------------------------------- 管理操作 */

awdRouter.post(
  '/competitions/:id/prepare',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (user.role === 'USER') throw ApiError.forbidden();
    const competitionId = BigInt(req.params.id!);
    const result = await prepareTargets(competitionId);
    await audit(req, user, 'awd.prepare', 'competition', competitionId, JSON.stringify(result));
    return ok(res, result);
  }),
);

awdRouter.post(
  '/competitions/:id/tick',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (user.role === 'USER') throw ApiError.forbidden();
    await tickAwx(new Date());
    return ok(res, { ok: true });
  }),
);

awdRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (user.role === 'USER') throw ApiError.forbidden();
    return ok(res, await awxDockerStats());
  }),
);

/** 手工重开某台靶机（学生把容器玩坏了） */
awdRouter.post(
  '/targets/:id/restart',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const target = await prisma.awxTarget.findUnique({
      where: { id: BigInt(req.params.id!) },
      include: { awxService: true },
    });
    if (!target) throw ApiError.notFound('靶机不存在');
    if (user.role === 'USER') {
      const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
      if (!membership || membership.teamId !== target.teamId) throw ApiError.forbidden('只能重启自己队伍的靶机');
    }
    await stopAwxTarget(target);
    const fresh = await prisma.awxTarget.findUnique({ where: { id: target.id }, include: { awxService: true } });
    await startAwxTarget(fresh!, fresh!.awxService);
    await audit(req, user, 'awd.restart_target', 'awx_target', target.id);
    return ok(res, { ok: true });
  }),
);
