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
import { authRouter } from './routes/auth.js';
import { siteRouter } from './routes/site.js';
import { challengeRouter, submissionRouter } from './routes/challenges.js';
import { scoreboardRouter } from './routes/scoreboard.js';
import { teamRouter } from './routes/teams.js';
import { competitionRouter } from './routes/competitions.js';
import { awdRouter } from './routes/awd.js';

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

  app.use('/api/auth', authRouter);
  app.use('/api/site', siteRouter);
  app.use('/api/challenges', challengeRouter);
  app.use('/api/submissions', submissionRouter);
  app.use('/api/scoreboard', scoreboardRouter);
  app.use('/api/teams', teamRouter);
  app.use('/api/competitions', competitionRouter);
  app.use('/api/awd', awdRouter);

  // 前端构建产物（存在时由后端托管）
  const webDist = path.resolve(config.rootDir, '../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
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
