import type { FastifyInstance } from 'fastify';
import type { TtsProvider } from '@companion/core';
import type { Env } from '../env.js';

export async function voicesRoute(app: FastifyInstance, deps: { tts: TtsProvider; env: Env }) {
  app.get('/v1/voices', async (_req, reply) => {
    try {
      const voices = await deps.tts.listVoices();
      return { voices };
    } catch (err) {
      app.log.warn(err, 'Failed to fetch voices from VoiceStudio');
      return { voices: [] };
    }
  });
}

