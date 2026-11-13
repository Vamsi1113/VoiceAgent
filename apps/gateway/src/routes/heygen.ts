import type { FastifyInstance } from 'fastify';
import type { Env } from '../env.js';

export async function heygenRoutes(app: FastifyInstance, deps: { env: Env }) {
  app.post('/v1/heygen/token', async (_req, reply) => {
    if (!deps.env.HEYGEN_API_KEY) {
      return reply.status(400).send({
        error: {
          code: 'MISSING_API_KEY',
          message: 'HEYGEN_API_KEY is not configured in .env. Please add your HeyGen API key to companion/.env',
        },
      });
    }

    try {
      const res = await fetch('https://api.heygen.com/v1/streaming.create_token', {
        method: 'POST',
        headers: {
          'x-api-key': deps.env.HEYGEN_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return reply.status(res.status).send({
          error: {
            code: 'HEYGEN_API_ERROR',
            message: `HeyGen API error (${res.status}): ${body}`,
          },
        });
      }

      const json = (await res.json()) as { data?: { token?: string } };
      const token = json.data?.token;
      if (!token) {
        return reply.status(500).send({
          error: { code: 'INVALID_RESPONSE', message: 'No session token returned by HeyGen' },
        });
      }

      return {
        token,
        avatarId: deps.env.HEYGEN_AVATAR_ID || undefined,
      };
    } catch (err) {
      return reply.status(500).send({
        error: {
          code: 'FETCH_FAILED',
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  });
}

