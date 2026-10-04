import Docker from 'dockerode';
import type { Challenge, ChallengeInstance } from '@prisma/client';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { getBool, getInt } from '../lib/settings.js';
import { ApiError } from '../lib/errors.js';
import { renderFlagTemplate } from './judge.js';

/**
 * 动态靶机：每队/每人一份独立容器。
 *
 * 不用 Docker 时（默认）所有操作都会给出友好提示，不会把接口打挂。
 * 打开方式：DOCKER_ENABLED=true，并保证宿主机上能访问 Docker socket。
 */
let client: Docker | null = null;

function dockerEnabled(): boolean {
  return config.docker.enabled && getBool('docker.enabled');
}

export function dockerAvailable(): boolean {
  return dockerEnabled();
}

function getClient(): Docker {
  if (!client) {
    const isTcp = config.docker.host.startsWith('tcp://') || config.docker.host.startsWith('http://');
    client = isTcp
      ? new Docker({ host: config.docker.host.replace(/^tcp:\/\//, 'http://').replace(/:\d+$/, ''), port: Number(config.docker.host.split(':').pop()) || 2375 })
      : new Docker({ socketPath: config.docker.host });
  }
  return client;
}

export async function pingDocker(): Promise<{ available: boolean; version?: string; message: string }> {
  if (!dockerEnabled()) return { available: false, message: '未启用动态靶机' };
  try {
    const info = await getClient().version();
    return { available: true, version: info.Version, message: 'Docker 连接正常' };
  } catch (err) {
    return { available: false, message: `连接 Docker 失败：${(err as Error).message}` };
  }
}

/** 找一个没被占用的宿主端口 */
async function pickPort(): Promise<number> {
  const used = new Set(
    (await prisma.challengeInstance.findMany({ where: { port: { not: null } }, select: { port: true } }))
      .map((row) => row.port)
      .filter((p): p is number => p !== null),
  );
  for (let port = config.docker.portStart; port <= config.docker.portEnd; port++) {
    if (!used.has(port)) return port;
  }
  throw ApiError.badRequest('靶机端口已用尽，请联系管理员');
}

export interface StartInstanceInput {
  challenge: Challenge;
  userId: bigint;
  teamId: bigint | null;
  competitionId: bigint;
}

/**
 * 启动一个靶机实例。已经在跑的直接复用，不会重复起容器。
 */
export async function startInstance(input: StartInstanceInput): Promise<ChallengeInstance> {
  const { challenge, userId, teamId, competitionId } = input;

  const running = await prisma.challengeInstance.findFirst({
    where: { challengeId: challenge.id, userId, status: 'RUNNING', expiresAt: { gt: new Date() } },
    orderBy: { id: 'desc' },
  });
  if (running) return running;

  const ttlMinutes = getInt('docker.instance_ttl_minutes') || 60;
  const maxPerUser = getInt('docker.max_instance_per_user') || 2;
  const active = await prisma.challengeInstance.count({ where: { userId, status: 'RUNNING' } });
  if (active >= maxPerUser) throw ApiError.badRequest(`同时最多运行 ${maxPerUser} 个靶机，请先停掉一个`);

  const flag = renderFlagTemplate('flag{{{random}}}', { team: teamId ?? userId, round: 0 });
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  const record = await prisma.challengeInstance.create({
    data: {
      challengeId: challenge.id,
      userId,
      teamId,
      competitionId,
      status: 'CREATING',
      instanceFlag: flag,
      expiresAt,
    },
  });

  if (!dockerEnabled()) {
    return prisma.challengeInstance.update({
      where: { id: record.id },
      data: {
        status: 'FAILED',
        errorMessage: '本机未启用动态靶机（DOCKER_ENABLED=true 后可用）',
      },
    });
  }
  if (!challenge.dockerImage) {
    return prisma.challengeInstance.update({
      where: { id: record.id },
      data: { status: 'FAILED', errorMessage: '题目没有配置镜像' },
    });
  }

  try {
    const port = await pickPort();
    const container = await getClient().createContainer({
      Image: challenge.dockerImage,
      name: `jnctf-${challenge.id}-${userId}-${Date.now()}`,
      Env: [`FLAG=${flag}`, `JNCTF_FLAG=${flag}`],
      ExposedPorts: challenge.containerPort ? { [`${challenge.containerPort}/tcp`]: {} } : undefined,
      HostConfig: {
        PortBindings: challenge.containerPort ? { [`${challenge.containerPort}/tcp`]: [{ HostPort: String(port) }] } : undefined,
        Memory: challenge.memoryLimitMb * 1024 * 1024,
        NanoCpus: Math.round(Number(challenge.cpuLimit || '0.5') * 1e9),
        NetworkMode: config.docker.network,
        AutoRemove: false,
        SecurityOpt: ['no-new-privileges'],
      },
    });
    await container.start();
    logger.info({ containerId: container.id, challengeId: challenge.id }, '靶机已启动');
    return prisma.challengeInstance.update({
      where: { id: record.id },
      data: {
        status: 'RUNNING',
        containerId: container.id,
        host: config.docker.publicHost,
        port: challenge.containerPort ? port : null,
      },
    });
  } catch (err) {
    logger.warn({ err }, '启动靶机失败');
    return prisma.challengeInstance.update({
      where: { id: record.id },
      data: { status: 'FAILED', errorMessage: (err as Error).message.slice(0, 500) },
    });
  }
}

export async function stopInstance(challengeId: bigint, userId: bigint): Promise<void> {
  const instances = await prisma.challengeInstance.findMany({
    where: { challengeId, userId, status: 'RUNNING' },
  });
  for (const instance of instances) {
    if (instance.containerId && dockerEnabled()) {
      try {
        const container = getClient().getContainer(instance.containerId);
        await container.stop({ t: 3 }).catch(() => undefined);
        await container.remove({ force: true }).catch(() => undefined);
      } catch (err) {
        logger.warn({ err, id: instance.id }, '停止靶机失败');
      }
    }
    await prisma.challengeInstance.update({
      where: { id: instance.id },
      data: { status: 'STOPPED' },
    });
  }
}

/** 定时任务调用：回收过期实例 */
export async function reapExpiredInstances(): Promise<number> {
  const expired = await prisma.challengeInstance.findMany({
    where: { status: 'RUNNING', expiresAt: { lt: new Date() } },
  });
  for (const instance of expired) {
    if (instance.containerId && dockerEnabled()) {
      try {
        const container = getClient().getContainer(instance.containerId);
        await container.remove({ force: true });
      } catch {
        /* 容器可能已经不在了 */
      }
    }
    await prisma.challengeInstance.update({ where: { id: instance.id }, data: { status: 'EXPIRED' } });
  }
  return expired.length;
}

export async function stats(): Promise<Record<string, number>> {
  const [running, total] = await Promise.all([
    prisma.challengeInstance.count({ where: { status: 'RUNNING' } }),
    prisma.challengeInstance.count(),
  ]);
  return { running, total, enabled: dockerEnabled() ? 1 : 0 };
}
