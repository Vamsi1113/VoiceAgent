import type { FastifyInstance } from 'fastify';
import type { Env } from '../env.js';
import type { LlmProvider, SttProvider, TtsProvider } from '@companion/core';

export async function healthzRoute(
  app: FastifyInstance,
  deps: { env: Env; stt: SttProvider; tts: TtsProvider; llm: LlmProvider },
) {
  app.get('/healthz', async (_req, reply) => {
    const checks: Record<string, string> = { gateway: 'ok' };

    // Check VoiceStudio
    try {
      const res = await fetch(`${deps.env.VOICESTUDIO_BASE_URL}/v1/models`, {
        signal: AbortSignal.timeout(3000),
      });
      checks['voicestudio'] = res.ok ? 'ok' : `error:${res.status}`;
    } catch {
      checks['voicestudio'] = 'unreachable';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');
    return reply.status(allOk ? 200 : 503).send(checks);
  });
}

