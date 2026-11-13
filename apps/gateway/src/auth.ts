import jwt from 'jsonwebtoken';
import type { Env } from './env.js';

export interface TokenPayload {
  deviceId: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export function signAccessToken(deviceId: string, secret: string): string {
  return jwt.sign({ deviceId, type: 'access' }, secret, { expiresIn: '30d' });
}

export function signRefreshToken(deviceId: string, secret: string): string {
  return jwt.sign({ deviceId, type: 'refresh' }, secret, { expiresIn: '30d' });
}

export function verifyToken(token: string, secret: string): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
}

export function generatePairingCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  const str = n.toString().padStart(6, '0');
  return `${str.slice(0, 3)}-${str.slice(3)}`;
}

