import 'node:process';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { createDb, MemoryService } from '@companion/memory';
import { AnthropicLlm, OpenAICompatLlm, VoiceStudioStt, VoiceStudioTts } from '@companion/providers';
import type { LlmProvider } from '@companion/core';
import { DefaultApprovalPolicy } from '@companion/core';
import { buildEnv } from './env.js';
import { healthzRoute } from './routes/healthz.js';
import { pairingRoutes } from './routes/pairing.js';
import { memoriesRoute } from './routes/memories.js';
import { voicesRoute } from './routes/voices.js';
import { ttsRoute } from './routes/tts.js';
import { assistantRoute } from './routes/assistant.js';
import { auditRoute } from './routes/audit.js';
import { heygenRoutes } from './routes/heygen.js';
import { sessionWsRoute } from './ws/session.js';
import { buildToolRegistry } from './tools/index.js';
import { loadPersona } from './persona.js';

const env = buildEnv();

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
  },
});

// ── Plugins ───────────────────────────────────────────────────────────────────
await app.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
});

await app.register(rateLimit, {
  global: false, // apply per-route
  max: 100,
  timeWindow: '1 minute',
});

await app.register(websocket);

// ── Infrastructure ────────────────────────────────────────────────────────────
const db = createDb(env.DATABASE_PATH);
const memoryService = new MemoryService(db);
const persona = await loadPersona();

// Providers — created from env, never exposed to clients
const llm: LlmProvider =
  env.LLM_PROVIDER === 'openai-compat'
    ? new OpenAICompatLlm({
        baseUrl: env.OPENAI_COMPAT_BASE_URL,
        apiKey: env.OPENAI_COMPAT_API_KEY,
        model: env.LLM_MODEL || 'llama3.2',
      })
    : new AnthropicLlm({
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.LLM_MODEL,
      });
const stt = new VoiceStudioStt(
  env.VOICESTUDIO_BASE_URL,
  env.OMNIVOICE_API_KEY || undefined,
);
const tts = new VoiceStudioTts(
  env.VOICESTUDIO_BASE_URL,
  env.OMNIVOICE_API_KEY || undefined,
);

const toolRegistry = buildToolRegistry({ memoryService, db });
const approvalPolicy = new DefaultApprovalPolicy();

// ── Routes ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fastifyApp = app as any;
await healthzRoute(fastifyApp, { env, stt, tts, llm });
await pairingRoutes(fastifyApp, { db, env });
await memoriesRoute(fastifyApp, { memoryService, env });
await voicesRoute(fastifyApp, { tts, env });
await ttsRoute(fastifyApp, { tts, env });
await assistantRoute(fastifyApp, { persona, env });
await auditRoute(fastifyApp, { db, env });
await heygenRoutes(fastifyApp, { env });

// ── Root info / redirect ───────────────────────────────────────────────────────
fastifyApp.get('/', async (_req: any, reply: any) => {
  return reply.redirect('http://localhost:5173/');
});

// ── WebSocket session ─────────────────────────────────────────────────────────
await sessionWsRoute(fastifyApp, {
  db,
  env,
  llm,
  stt,
  tts,
  toolRegistry,
  approvalPolicy,
  memoryService,
  persona,
});

// ── Start ─────────────────────────────────────────────────────────────────────
try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Gateway running at http://${env.HOST}:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
