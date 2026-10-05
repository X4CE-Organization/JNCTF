import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import path from 'node:path';
import fs from 'node:fs';

import { config } from './config.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './lib/errors.js';
import { attachUser } from './middleware/auth.js';
import { getBool, getSetting } from './lib/settings.js';
import { authRouter } from './routes/auth.js';
import { oauthRouter } from './routes/oauth.js';
import { articleRouter, discussionRouter, momentRouter } from './routes/feed.js';
import { shopRouter } from './routes/shop.js';
import { creationRouter } from './routes/creation.js';
import { messageRouter } from './routes/messages.js';
import { siteRouter } from './routes/site.js';
import { challengeRouter, submissionRouter } from './routes/challenges.js';
import { scoreboardRouter } from './routes/scoreboard.js';
import { teamRouter } from './routes/teams.js';
import { competitionRouter } from './routes/competitions.js';
import { awdRouter } from './routes/awd.js';
import { adminRouter } from './routes/admin.js';
import { uploadRouter } from './routes/uploads.js';
import { notificationRouter, ticketRouter, userRouter, writeupRouter } from './routes/community.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', true);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: config.isProd }));

  // 上传目录直接暴露成静态资源
  if (!fs.existsSync(config.uploadDir)) fs.mkdirSync(config.uploadDir, { recursive: true });
  app.use('/uploads', express.static(path.resolve(config.uploadDir)));

  app.use(attachUser);

  /**
   * 维护模式：前台照常返回 SPA（由前端渲染提示页），API 只放行
   * 登录相关、站点元信息和管理接口，管理员不受影响。
   */
  app.use((req, res, next) => {
    if (!getBool('site.maintenance')) return next();
    if (!req.path.startsWith('/api/')) return next();
    if (['/api/auth', '/api/admin', '/api/site'].some((prefix) => req.path.startsWith(prefix))) return next();
    if (req.user && req.user.role !== 'USER') return next();
    res.status(503).json({
      success: false,
      error: { code: 'MAINTENANCE', message: getSetting('site.maintenance_notice') || '站点正在维护' },
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/auth/oauth', oauthRouter);
  app.use('/api/moments', momentRouter);
  app.use('/api/discussions', discussionRouter);
  app.use('/api/articles', articleRouter);
  app.use('/api/shop', shopRouter);
  app.use('/api/creation', creationRouter);
  app.use('/api/messages', messageRouter);
  app.use('/api/site', siteRouter);
  app.use('/api/challenges', challengeRouter);
  app.use('/api/submissions', submissionRouter);
  app.use('/api/scoreboard', scoreboardRouter);
  app.use('/api/teams', teamRouter);
  app.use('/api/competitions', competitionRouter);
  app.use('/api/awd', awdRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/writeups', writeupRouter);
  app.use('/api/tickets', ticketRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/users', userRouter);

  // 前端构建产物（存在时由后端托管）
  // 源码运行时是 server/ 与 web/ 平级；容器镜像里两者都放在 /app 下，所以两种布局都试一下
  const webDist = [
    path.resolve(config.rootDir, '../web/dist'),
    path.resolve(config.rootDir, 'web/dist'),
  ].find((dir) => fs.existsSync(path.join(dir, 'index.html')));
  if (webDist) {
    // 带内容哈希的 /assets/ 可以长期缓存；入口 HTML 必须每次校验，
    // 否则发版后浏览器会继续跑旧的前端。
    app.use(
      express.static(webDist, {
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          }
        },
      }),
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.sendFile(path.join(webDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({ name: 'JNCTF', message: '后端已启动，前端尚未构建（cd web && npm run build）' });
    });
  }

  app.use(errorHandler);
  return app;
}
