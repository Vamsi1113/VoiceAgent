import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('127.0.0.1'),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_PATH: z.string().default('./data/companion.db'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  LLM_PROVIDER: z.enum(['anthropic', 'openai-compat']).default('openai-compat'),
  LLM_MODEL: z.string().default('qwen2.5:7b'),
  ANTHROPIC_API_KEY: z.string().default(''),
  OPENAI_COMPAT_BASE_URL: z.string().default('http://localhost:11434/v1'),
  OPENAI_COMPAT_API_KEY: z.string().default(''),
  VOICESTUDIO_BASE_URL: z.string().default('http://localhost:3900'),
  OMNIVOICE_API_KEY: z.string().default(''),
  VOICE_ID: z.string().default('alloy'),
  TTS_PROVIDER: z.enum(['voicestudio', 'heygen', 'none']).default('heygen'),
  HEYGEN_API_KEY: z.string().default(''),
  HEYGEN_AVATAR_ID: z.string().default(''),
  MCP_AUTH_ENABLED: z.coerce.number().default(0),
});

export type Env = z.infer<typeof envSchema>;

export function buildEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten());
    process.exit(1);
  }
  return result.data;
}

