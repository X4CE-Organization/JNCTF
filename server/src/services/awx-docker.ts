import Docker from 'dockerode';
import type { AwxService, AwxTarget } from '@prisma/client';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { getBool } from '../lib/settings.js';

/**
 * AWD 靶机容器管理。
 *
 * 和动态题的实现分开，是因为 AWD 需要在回合开始时「把新 flag 写进已有的容器」，
 * 而不是重建容器——重建会打断选手正在做的题。
 */
let client: Docker | null = null;

export function dockerAvailable(): boolean {
  return config.docker.enabled && getBool('docker.enabled');
}

function getClient(): Docker {
  if (!client) {
    const isTcp = config.docker.host.startsWith('tcp://') || config.docker.host.startsWith('http://');
    client = isTcp
      ? new Docker({
          host: config.docker.host.replace(/^tcp:\/\//, 'http://').replace(/:\d+$/, ''),
          port: Number(config.docker.host.split(':').pop()) || 2375,
        })
      : new Docker({ socketPath: config.docker.host });
  }
  return client;
}

async function pickPort(): Promise<number> {
  const used = new Set(
    (await prisma.awxTarget.findMany({ where: { port: { not: null } }, select: { port: true } }))
      .map((row) => row.port)
      .filter((p): p is number => p !== null),
  );
  for (let port = config.docker.portStart; port <= config.docker.portEnd; port++) {
    if (!used.has(port)) return port;
  }
  throw new Error('端口耗尽');
}

/**
 * 为某支队伍起一台 AWD 靶机。
 * 容器一直存活到比赛结束，回合之间只换 flag。
 */
export async function startAwxTarget(target: AwxTarget, service: AwxService): Promise<boolean> {
  if (!dockerAvailable()) {
    await prisma.awxTarget.update({
      where: { id: target.id },
      data: { status: 'FAILED', errorMessage: '本机未启用靶机（DOCKER_ENABLED=true）' },
    });
    return false;
  }
  try {
    const port = await pickPort();
    const container = await getClient().createContainer({
      Image: service.dockerImage,
      name: `jnctf-awd-${service.id}-${target.teamId}-${Date.now()}`,
      Env: [`${service.flagEnv || 'FLAG'}=pending`, 'TEAM_ID=' + String(target.teamId)],
      ExposedPorts: { [`${service.internalPort}/tcp`]: {} },
      HostConfig: {
        PortBindings: { [`${service.internalPort}/tcp`]: [{ HostPort: String(port) }] },
        Memory: service.memoryLimitMb * 1024 * 1024,
        NanoCpus: Math.round(Number(service.cpuLimit || '1') * 1e9),
        NetworkMode: config.docker.network,
        SecurityOpt: ['no-new-privileges'],
      },
    });
    await container.start();
    await prisma.awxTarget.update({
      where: { id: target.id },
      data: {
        status: 'RUNNING',
        containerId: container.id,
        host: config.docker.publicHost,
        port,
        errorMessage: null,
      },
    });
    logger.info({ targetId: target.id, teamId: target.teamId, port }, 'AWD 靶机已启动');
    return true;
  } catch (err) {
    logger.warn({ err, targetId: target.id }, '启动 AWD 靶机失败');
    await prisma.awxTarget.update({
      where: { id: target.id },
      data: { status: 'FAILED', errorMessage: (err as Error).message.slice(0, 500) },
    });
    return false;
  }
}

/**
 * 把新 flag 写进正在运行的容器。
 *
 * 做法是进容器里执行一条命令：
 *   有 flagFile → 写文件；否则只更新环境变量（环境变量改了不会影响已运行的进程，
 *   所以主要靠文件方式；两者都配就都写）。
 */
export async function writeFlagIntoContainer(target: AwxTarget, service: AwxService, flag: string): Promise<void> {
  if (!dockerAvailable() || !target.containerId) return;
  try {
    const container = getClient().getContainer(target.containerId);
    const commands: string[] = [];
    if (service.flagFile) {
      commands.push(`mkdir -p "$(dirname '${service.flagFile}')" && printf '%s' '${flag}' > '${service.flagFile}'`);
    }
    if (!commands.length) return;
    const exec = await container.exec({
      Cmd: ['/bin/sh', '-c', commands.join(' && ')],
      AttachStdout: true,
      AttachStderr: true,
    });
    await exec.start({});
  } catch (err) {
    logger.warn({ err, targetId: target.id }, '写入 flag 到容器失败');
  }
}

export async function stopAwxTarget(target: AwxTarget): Promise<void> {
  if (target.containerId && dockerAvailable()) {
    try {
      const container = getClient().getContainer(target.containerId);
      await container.stop({ t: 3 }).catch(() => undefined);
      await container.remove({ force: true }).catch(() => undefined);
    } catch (err) {
      logger.warn({ err, targetId: target.id }, '停止 AWD 靶机失败');
    }
  }
  await prisma.awxTarget.update({ where: { id: target.id }, data: { status: 'STOPPED', alive: false } });
}

export async function awxDockerStats(): Promise<Record<string, number>> {
  const [running, failed, total] = await Promise.all([
    prisma.awxTarget.count({ where: { status: 'RUNNING' } }),
    prisma.awxTarget.count({ where: { status: 'FAILED' } }),
    prisma.awxTarget.count(),
  ]);
  return { running, failed, total, enabled: dockerAvailable() ? 1 : 0 };
}
