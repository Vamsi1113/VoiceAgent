import type { FastifyInstance } from 'fastify';
import type { Persona } from '@companion/core';
import type { Env } from '../env.js';

export async function assistantRoute(
  app: FastifyInstance,
  deps: { persona: Persona & { avatarUrl?: string; defaultMood?: string }; env: Env },
) {
  app.get('/v1/assistant', async () => {
    // Return non-secret persona info
    return {
      name: deps.persona.name,
      voiceId: deps.persona.voiceId,
      language: deps.persona.language,
      avatarUrl: deps.persona.avatarUrl ?? null,
      defaultMood: deps.persona.defaultMood ?? 'neutral',
    };
  });
}

