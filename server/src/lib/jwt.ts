import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AccessPayload {
  sub: string;
  username: string;
  role: string;
  typ: 'access';
}

export interface RefreshPayload {
  sub: string;
  typ: 'refresh';
}

export function issueAccessToken(userId: bigint | number, username: string, role: string): string {
  return jwt.sign(
    { username, role, typ: 'access' },
    config.jwt.secret,
    { subject: String(userId), expiresIn: `${config.jwt.accessMinutes}m` },
  );
}

export function issueRefreshToken(userId: bigint | number): string {
  return jwt.sign({ typ: 'refresh' }, config.jwt.secret, {
    subject: String(userId),
    expiresIn: `${config.jwt.refreshDays}d`,
  });
}

export function verifyToken<T extends object>(token: string): T | null {
  try {
    return jwt.verify(token, config.jwt.secret) as T;
  } catch {
    return null;
  }
}

export function accessTokenSeconds(): number {
  return config.jwt.accessMinutes * 60;
}
