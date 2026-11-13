import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db } from '@companion/memory';
import { schema, desc } from '@companion/memory';
import type { Env } from '../env.js';
import { verifyToken } from '../auth.js';

export async function auditRoute(app: FastifyInstance, deps: { db: Db; env: Env }) {
  app.get('/v1/audit', async (req: FastifyRequest, reply) => {
    const token = req.headers.authorization?.slice(7);
    if (!token) return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
    try {
      verifyToken(token, deps.env.JWT_SECRET);
    } catch {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }

    const { limit = '50' } = req.query as Record<string, string>;
    const rows = await deps.db
      .select()
      .from(schema.toolAudit)
      .orderBy(desc(schema.toolAudit.ts))
      .limit(parseInt(limit));
    return rows;
  });
}

