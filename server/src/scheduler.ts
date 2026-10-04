import { logger } from './lib/logger.js';
import { tickAwx } from './services/awd.js';
import { reapExpiredInstances } from './services/docker.js';
import { warmSettings } from './lib/settings.js';

/**
 * 后台定时任务。用最简单的 setInterval，不引 Quartz 那套重家伙。
 *
 *   - 每 30 秒：推进 AWD 回合（开始 / 结算）
 *   - 每 5 分钟：回收过期的动态靶机
 *   - 每 60 秒：重载站点设置，保证多实例部署时配置一致
 */
export function startScheduler(): NodeJS.Timeout[] {
  const timers: NodeJS.Timeout[] = [];

  timers.push(
    setInterval(() => {
      tickAwx().catch((err) => logger.warn({ err }, 'AWD 回合推进失败'));
    }, 30_000),
  );

  timers.push(
    setInterval(() => {
      reapExpiredInstances()
        .then((count) => {
          if (count > 0) logger.info({ count }, '已回收过期靶机');
        })
        .catch((err) => logger.warn({ err }, '回收靶机失败'));
    }, 300_000),
  );

  timers.push(
    setInterval(() => {
      warmSettings().catch(() => undefined);
    }, 60_000),
  );

  logger.info('定时任务已启动');
  return timers;
}
