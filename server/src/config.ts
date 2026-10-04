import 'dotenv/config';
import path from 'node:path';

function env(key: string, fallback = ''): string {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

function num(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}

function bool(key: string, fallback = false): boolean {
  const value = process.env[key];
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const rootDir = path.resolve(import.meta.dirname, '..');

export const config = {
  env: env('NODE_ENV', 'development'),
  port: num('PORT', 8080),
  siteUrl: env('SITE_URL', 'http://localhost:8080').replace(/\/$/, ''),
  rootDir,

  databaseUrl: env('DATABASE_URL', 'postgresql://localhost:5432/jnctf?schema=public'),

  redis: {
    host: env('REDIS_HOST', 'localhost'),
    port: num('REDIS_PORT', 6379),
    password: env('REDIS_PASSWORD') || undefined,
  },

  jwt: {
    // 生产环境务必替换：openssl rand -base64 48
    secret: env('JWT_SECRET', 'jnctf-dev-secret-change-me-0123456789abcdef'),
    accessMinutes: num('JWT_ACCESS_MINUTES', 120),
    refreshDays: num('JWT_REFRESH_DAYS', 14),
  },

  uploadDir: path.resolve(rootDir, env('UPLOAD_DIR', './data/uploads')),
  maxUploadMb: num('MAX_UPLOAD_MB', 100),

  mail: {
    enabled: bool('MAIL_ENABLED'),
    host: env('MAIL_HOST', 'localhost'),
    port: num('MAIL_PORT', 25),
    user: env('MAIL_USERNAME'),
    pass: env('MAIL_PASSWORD'),
    from: env('MAIL_FROM', 'JNCTF <no-reply@localhost>'),
    tls: bool('MAIL_TLS'),
  },

  docker: {
    enabled: bool('DOCKER_ENABLED'),
    host: env('DOCKER_HOST', '/var/run/docker.sock'),
    network: env('DOCKER_NETWORK', 'jnctf-challenges'),
    publicHost: env('DOCKER_PUBLIC_HOST', 'localhost'),
    portStart: num('DOCKER_PORT_START', 30000),
    portEnd: num('DOCKER_PORT_END', 31000),
  },

  init: {
    username: env('ROOT_USERNAME', 'root'),
    password: env('ROOT_PASSWORD', 'jnctf123456'),
    email: env('ROOT_EMAIL', 'root@jnctf.local'),
  },

  isProd: env('NODE_ENV') === 'production',
};

export type AppConfig = typeof config;
