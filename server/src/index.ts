import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { initRedis } from './lib/redis.js';
import { warmSettings } from './lib/settings.js';
import { ensureSeed } from './seed.js';

async function main() {
  await prisma.$connect();
  await initRedis();
  await warmSettings();
  await ensureSeed();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`JNCTF 后端已启动: http://localhost:${config.port}  (${config.env})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`收到 ${signal}，正在关闭…`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, '启动失败');
  process.exit(1);
});
