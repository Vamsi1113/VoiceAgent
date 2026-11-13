import type { FastifyInstance } from 'fastify';
import { randomUUID, createHash } from 'node:crypto';
import type { Db } from '@companion/memory';
import { schema, eq } from '@companion/memory';
import type { Env } from '../env.js';
import { signAccessToken, signRefreshToken, generatePairingCode, verifyToken } from '../auth.js';

export async function pairingRoutes(app: FastifyInstance, deps: { db: Db; env: Env }) {
  const { db, env } = deps;

  // Start pairing (new device requests a code)
  app.post('/v1/pairing/start', {
    config: { rateLimit: { max: 5, timeWindow: '5 minutes' } },
  }, async (req, reply) => {
    const body = req.body as { deviceName?: string; clientType?: string };
    if (!body.deviceName || !body.clientType) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'deviceName and clientType required' } });
    }

    const id = randomUUID();
    const code = generatePairingCode();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await db.insert(schema.pairingRequests).values({
      id,
      code,
      deviceName: body.deviceName,
      clientType: body.clientType,
      approved: 0,
      expiresAt,
      createdAt: Date.now(),
    });

    app.log.info({ pairingId: id }, 'Pairing started');
    return { pairingId: id, code, expiresAt };
  });

  // Approve a pairing (from trusted device or CLI)
  app.post('/v1/pairing/approve', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (req, reply) => {
    const body = req.body as { code?: string };
    if (!body.code) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'code required' } });
    }

    const [request] = await db
      .select()
      .from(schema.pairingRequests)
      .where(eq(schema.pairingRequests.code, body.code));

    if (!request || request.expiresAt < Date.now()) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pairing code not found or expired' } });
    }

    await db
      .update(schema.pairingRequests)
      .set({ approved: 1 })
      .where(eq(schema.pairingRequests.id, request.id));

    return { ok: true };
  });

  // Complete pairing (device polls until approved, then gets tokens)
  app.post('/v1/pairing/complete', {
    config: { rateLimit: { max: 20, timeWindow: '5 minutes' } },
  }, async (req, reply) => {
    const body = req.body as { pairingId?: string };
    if (!body.pairingId) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'pairingId required' } });
    }

    const [request] = await db
      .select()
      .from(schema.pairingRequests)
      .where(eq(schema.pairingRequests.id, body.pairingId));

    if (!request || request.expiresAt < Date.now()) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pairing request not found or expired' } });
    }

    if (!request.approved) {
      return reply.status(202).send({ status: 'pending' });
    }

    // Create device record
    const deviceId = randomUUID();
    const now = Date.now();
    await db.insert(schema.devices).values({
      id: deviceId,
      name: request.deviceName,
      clientType: request.clientType,
      createdAt: now,
      lastSeenAt: now,
      revoked: 0,
    });

    // Issue tokens
    const accessToken = signAccessToken(deviceId, env.JWT_SECRET);
    const refreshToken = signRefreshToken(deviceId, env.JWT_SECRET);

    // Store hashed refresh token
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await db.insert(schema.refreshTokens).values({
      id: randomUUID(),
      deviceId,
      tokenHash,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    });

    // Cleanup pairing request
    await db.delete(schema.pairingRequests).where(eq(schema.pairingRequests.id, body.pairingId));

    app.log.info({ deviceId }, 'Device paired');
    return { accessToken, refreshToken, deviceId };
  });

  // Refresh access token
  app.post('/v1/auth/refresh', async (req, reply) => {
    const body = req.body as { refreshToken?: string };
    if (!body.refreshToken) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'refreshToken required' } });
    }

    try {
      const payload = verifyToken(body.refreshToken, env.JWT_SECRET);
      if (payload.type !== 'refresh') throw new Error('Not a refresh token');

      const tokenHash = createHash('sha256').update(body.refreshToken).digest('hex');
      const [stored] = await db
        .select()
        .from(schema.refreshTokens)
        .where(eq(schema.refreshTokens.tokenHash, tokenHash));

      if (!stored || stored.expiresAt < Date.now()) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Refresh token expired' } });
      }

      const accessToken = signAccessToken(payload.deviceId, env.JWT_SECRET);
      return { accessToken };
    } catch {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
  });
}

