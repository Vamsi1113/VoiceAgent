import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { MemoryService } from '@companion/memory';
import type { Env } from '../env.js';
import { verifyToken } from '../auth.js';

function extractToken(req: FastifyRequest): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export async function memoriesRoute(
  app: FastifyInstance,
  deps: { memoryService: MemoryService; env: Env },
) {
  const { memoryService, env } = deps;

  const authPreHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const token = extractToken(req);
    if (!token) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
    }
    try {
      verifyToken(token, env.JWT_SECRET);
    } catch {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
  };

  app.get('/v1/memories', { preHandler: [authPreHandler] }, async (req) => {
    const { query = '', limit = '50' } = req.query as Record<string, string>;
    const memories = query
      ? await memoryService.search(query, parseInt(limit))
      : await memoryService.list(parseInt(limit));
    return memories;
  });

  app.post('/v1/memories', { preHandler: [authPreHandler] }, async (req, reply) => {
    const body = req.body as { text?: string; category?: string };
    if (!body.text) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'text required' } });
    }
    const memory = await memoryService.add(body.text, body.category);
    return reply.status(201).send(memory);
  });

  app.patch('/v1/memories/:id', { preHandler: [authPreHandler] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { text?: string };
    if (!body.text) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'text required' } });
    }
    await memoryService.update(id, body.text);
    return { ok: true };
  });

  app.delete('/v1/memories/:id', { preHandler: [authPreHandler] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await memoryService.delete(id);
    return reply.status(204).send();
  });
}
