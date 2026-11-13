import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { TtsProvider } from '@companion/core';
import type { Env } from '../env.js';
import { verifyToken } from '../auth.js';

export async function ttsRoute(app: FastifyInstance, deps: { tts: TtsProvider; env: Env }) {
  const { tts, env } = deps;

  app.post(
    '/v1/tts',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req: FastifyRequest, reply) => {
      const token = req.headers.authorization?.slice(7);
      if (!token) return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
      try {
        verifyToken(token, env.JWT_SECRET);
      } catch {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
      }

      const body = req.body as { text?: string; voiceId?: string };
      if (!body.text) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'text required' } });
      }

      try {
        const { audio, mimeType } = await tts.synthesize(body.text, {
          voiceId: body.voiceId ?? env.VOICE_ID,
          signal: AbortSignal.timeout(10_000),
        });
        return reply
          .header('Content-Type', mimeType)
          .header('Content-Length', audio.byteLength)
          .send(Buffer.from(audio));
      } catch (err) {
        app.log.error(err, 'TTS failed');
        return reply.status(502).send({ error: { code: 'TTS_FAILED', message: 'Speech synthesis failed' } });
      }
    },
  );
}

