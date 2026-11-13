#!/usr/bin/env node
/**
 * pair:first — bootstrap the very first device.
 * Generates a one-time pairing code that can be used immediately.
 */
import { buildEnv } from '../env.js';
import { createDb } from '@companion/memory';
import { schema } from '@companion/memory';
import { randomUUID } from 'node:crypto';
import { signAccessToken, signRefreshToken, generatePairingCode } from '../auth.js';
import { createHash } from 'node:crypto';

const env = buildEnv();
const db = createDb(env.DATABASE_PATH);

console.log('\n🤖 Companion — First Device Pairing\n');
console.log('This creates a one-time token to pair the first device.\n');

const deviceId = randomUUID();
const now = Date.now();

await db.insert(schema.devices).values({
  id: deviceId,
  name: 'First Device',
  clientType: 'web',
  createdAt: now,
  lastSeenAt: now,
  revoked: 0,
});

const accessToken = signAccessToken(deviceId, env.JWT_SECRET);
const refreshToken = signRefreshToken(deviceId, env.JWT_SECRET);

const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
await db.insert(schema.refreshTokens).values({
  id: randomUUID(),
  deviceId,
  tokenHash,
  expiresAt: now + 30 * 24 * 60 * 60 * 1000,
});

console.log('✅ Device created:', deviceId);
console.log('\nAccess Token (valid 30 days):');
console.log(accessToken);
console.log('\nRefresh Token (valid 30 days):');
console.log(refreshToken);
console.log('\nCopy the access token and paste it into the web app when prompted.\n');

