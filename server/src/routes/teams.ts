import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, asyncHandler, ok } from '../lib/errors.js';
import { getBool, getInt } from '../lib/settings.js';
import { optionalUser, requireAuth } from '../middleware/auth.js';
import { audit, notify } from '../lib/audit.js';

export const teamRouter = Router();

const createSchema = z.object({
  name: z.string().trim().min(2, '队伍名至少 2 个字符').max(48),
  affiliation: z.string().trim().max(32).optional(),
  description: z.string().max(1000).optional(),
  website: z.string().max(128).optional(),
  avatar: z.string().max(512).optional(),
});

async function teamDetail(teamId: bigint, viewerId?: bigint) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      captain: { select: { id: true, username: true, displayName: true, avatar: true } },
      members: {
        include: { user: { select: { id: true, username: true, displayName: true, avatar: true, score: true, role: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
  if (!team) throw ApiError.notFound('队伍不存在');
  const solves = await prisma.solve.findMany({
    where: { teamId },
    include: { challenge: { select: { id: true, title: true, categoryId: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return {
    id: team.id,
    name: team.name,
    affiliation: team.affiliation ?? '',
    description: team.description ?? '',
    avatar: team.avatar ?? '',
    website: team.website ?? '',
    score: team.score,
    hidden: team.hidden,
    locked: team.locked,
    openJoin: team.openJoin,
    createdAt: team.createdAt,
    isMine: viewerId ? team.members.some((m) => m.userId === viewerId) : false,
    isCaptain: viewerId ? team.captainId === viewerId : false,
    // 邀请码只给队内成员看
    inviteCode: viewerId && team.members.some((m) => m.userId === viewerId) ? team.inviteCode : null,
    captain: team.captain,
    members: team.members.map((m) => ({
      id: m.user.id,
      username: m.user.username,
      displayName: m.user.displayName || m.user.username,
      avatar: m.user.avatar,
      score: m.user.score,
      captain: m.captain,
      joinedAt: m.joinedAt,
    })),
    solves: solves.map((s) => ({ id: s.id, challengeId: s.challengeId, title: s.challenge.title, score: s.score, createdAt: s.createdAt })),
  };
}

/* ---------------------------------------------------------------- 列表 */

teamRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const keyword = String(req.query.keyword ?? '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 30));
    const where: any = { banned: false };
    if (keyword) where.name = { contains: keyword, mode: 'insensitive' };
    const [total, rows] = await Promise.all([
      prisma.team.count({ where }),
      prisma.team.findMany({
        where,
        include: { _count: { select: { members: true } } },
        orderBy: [{ score: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * size,
        take: size,
      }),
    ]);
    return ok(res, {
      items: rows.map((t) => ({
        id: t.id,
        name: t.name,
        affiliation: t.affiliation ?? '',
        avatar: t.avatar ?? '',
        score: t.score,
        memberCount: t._count.members,
        hidden: t.hidden,
        locked: t.locked,
        createdAt: t.createdAt,
      })),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    });
  }),
);

/* ------------------------------------------------------------ 我的队伍 */

teamRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
    if (!membership) return ok(res, { team: null });
    return ok(res, { team: await teamDetail(membership.teamId, user.id) });
  }),
);

/* ---------------------------------------------------------------- 详情 */

teamRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const viewer = optionalUser(req);
    const team = await teamDetail(BigInt(req.params.id!), viewer?.id);
    if (team.hidden && viewer?.role === 'USER') throw ApiError.notFound('队伍不存在');
    return ok(res, team);
  }),
);

/* ---------------------------------------------------------------- 创建 */

teamRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (!getBool('site.allow_team')) throw ApiError.forbidden('本站已关闭组队功能');
    const body = createSchema.parse(req.body);
    if (await prisma.team.findUnique({ where: { name: body.name } })) throw ApiError.conflict('该队伍名已被占用');
    const existing = await prisma.teamMember.findUnique({ where: { userId: user.id } });
    if (existing) throw ApiError.badRequest('你已经在一支队伍里了，请先退出');

    const team = await prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          name: body.name,
          affiliation: body.affiliation,
          description: body.description,
          website: body.website,
          avatar: body.avatar,
          captainId: user.id,
          inviteCode: crypto.randomBytes(8).toString('hex'),
        },
      });
      await tx.teamMember.create({ data: { teamId: created.id, userId: user.id, captain: true } });
      return created;
    });
    await audit(req, user, 'team.create', 'team', team.id, team.name);
    return ok(res, { team: await teamDetail(team.id, user.id) }, 201);
  }),
);

/* ---------------------------------------------------------------- 修改 */

teamRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) throw ApiError.notFound('队伍不存在');
    if (team.captainId !== user.id && user.role === 'USER') throw ApiError.forbidden('只有队长可以修改队伍资料');
    const body = createSchema.partial().parse(req.body);
    if (body.name && body.name !== team.name && (await prisma.team.findUnique({ where: { name: body.name } }))) {
      throw ApiError.conflict('该队伍名已被占用');
    }
    await prisma.team.update({
      where: { id },
      data: {
        name: body.name,
        affiliation: body.affiliation,
        description: body.description,
        website: body.website,
        avatar: body.avatar,
      },
    });
    await audit(req, user, 'team.update', 'team', id);
    return ok(res, await teamDetail(id, user.id));
  }),
);

/* ---------------------------------------------------------- 加入 / 退出 */

teamRouter.post(
  '/join',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    if (!getBool('site.allow_team')) throw ApiError.forbidden('本站已关闭组队功能');
    const code = String(req.body?.code ?? '').trim();
    const teamId = req.body?.teamId ? BigInt(String(req.body.teamId)) : null;

    let team = null as Awaited<ReturnType<typeof prisma.team.findUnique>>;
    if (code) team = await prisma.team.findUnique({ where: { inviteCode: code } });
    if (!team && teamId) team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw ApiError.notFound('队伍不存在或邀请码无效');
    if (team.banned) throw ApiError.forbidden('该队伍已被封禁');
    if (!team.openJoin && !code) throw ApiError.forbidden('该队伍需要邀请码才能加入');

    const existing = await prisma.teamMember.findUnique({ where: { userId: user.id } });
    if (existing) throw ApiError.badRequest('你已经在一支队伍里了');

    const maxSize = Math.max(Number(team.affiliation ? 0 : 0) || 0, getInt('site.max_team_size') || 4);
    const count = await prisma.teamMember.count({ where: { teamId: team.id } });
    if (count >= maxSize) throw ApiError.badRequest(`队伍人数已满（上限 ${maxSize} 人）`);

    await prisma.teamMember.create({ data: { teamId: team.id, userId: user.id } });
    await prisma.teamInvite.updateMany({
      where: { code, usedBy: null },
      data: { usedBy: user.id, usedAt: new Date() },
    });
    await notify(team.captainId, 'TEAM', `${user.username} 加入了你的队伍`, team.name, `/teams/${team.id}`);
    await audit(req, user, 'team.join', 'team', team.id);
    return ok(res, await teamDetail(team.id, user.id));
  }),
);

teamRouter.post(
  '/leave',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const membership = await prisma.teamMember.findUnique({ where: { userId: user.id } });
    if (!membership) throw ApiError.badRequest('你还没有加入任何队伍');
    const team = await prisma.team.findUnique({ where: { id: membership.teamId } });
    if (!team) throw ApiError.notFound('队伍不存在');
    if (team.locked) throw ApiError.forbidden('比赛进行中，队伍已锁定，暂时不能退出');

    if (membership.captain) {
      const others = await prisma.teamMember.findMany({ where: { teamId: team.id, userId: { not: user.id } }, orderBy: { joinedAt: 'asc' } });
      if (others.length) {
        // 队长退出时自动把队长交给最早加入的队员
        await prisma.teamMember.update({ where: { id: others[0]!.id }, data: { captain: true } });
        await prisma.team.update({ where: { id: team.id }, data: { captainId: others[0]!.userId } });
      } else {
        // 最后一个人退出，队伍解散
        await prisma.team.delete({ where: { id: team.id } });
        await audit(req, user, 'team.disband', 'team', team.id);
        return ok(res, { ok: true, disbanded: true });
      }
    }
    await prisma.teamMember.delete({ where: { id: membership.id } });
    await audit(req, user, 'team.leave', 'team', team.id);
    return ok(res, { ok: true, disbanded: false });
  }),
);

/* -------------------------------------------------------------- 邀请码 */

teamRouter.post(
  '/:id/invite-code',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) throw ApiError.notFound('队伍不存在');
    if (team.captainId !== user.id) throw ApiError.forbidden('只有队长可以重置邀请码');
    const code = crypto.randomBytes(8).toString('hex');
    await prisma.team.update({ where: { id }, data: { inviteCode: code } });
    await audit(req, user, 'team.rotate_invite', 'team', id);
    return ok(res, { inviteCode: code });
  }),
);

teamRouter.post(
  '/:id/kick/:userId',
  asyncHandler(async (req, res) => {
    const user = requireAuth(req);
    const id = BigInt(req.params.id!);
    const targetId = BigInt(req.params.userId!);
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) throw ApiError.notFound('队伍不存在');
    if (team.captainId !== user.id && user.role === 'USER') throw ApiError.forbidden('只有队长可以移出成员');
    if (targetId === team.captainId) throw ApiError.badRequest('不能移除队长');
    await prisma.teamMember.deleteMany({ where: { teamId: id, userId: targetId } });
    await notify(targetId, 'TEAM', `你已被移出队伍 ${team.name}`, '', '/teams');
    await audit(req, user, 'team.kick', 'team', id, String(targetId));
    return ok(res, await teamDetail(id, user.id));
  }),
);

/* ------------------------------------------------------------ 成员提交记录 */

teamRouter.get(
  '/:id/submissions',
  asyncHandler(async (req, res) => {
    const id = BigInt(req.params.id!);
    const rows = await prisma.submission.findMany({
      where: { teamId: id },
      include: {
        challenge: { select: { id: true, title: true } },
        user: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });
    return ok(res, {
      items: rows.map((s) => ({
        id: s.id,
        challengeId: s.challengeId,
        challengeTitle: s.challenge.title,
        username: s.user.displayName || s.user.username,
        status: s.status,
        score: s.score,
        createdAt: s.createdAt,
      })),
    });
  }),
);
