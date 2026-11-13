import { z } from 'zod';

// ── Server → Client WebSocket messages ───────────────────────────────────────

export const SessionReadySchema = z.object({
  type: z.literal('session.ready'),
  sessionId: z.string(),
  assistant: z.object({
    name: z.string(),
    avatarUrl: z.string().optional(),
    voiceId: z.string(),
  }),
});

export const TurnTranscriptSchema = z.object({
  type: z.literal('turn.transcript'),
  turnId: z.string(),
  text: z.string(),
  final: z.boolean(),
});

export const AssistantTextDeltaSchema = z.object({
  type: z.literal('assistant.text.delta'),
  turnId: z.string(),
  text: z.string(),
});

export const AssistantSpeechHeaderSchema = z.object({
  type: z.literal('assistant.speech'),
  turnId: z.string(),
  seq: z.number().int().nonnegative(),
  text: z.string(),
  mimeType: z.string(),
  bytes: z.number().int().positive(),
});

export const AvatarEventSchema = z.object({
  type: z.literal('avatar.event'),
  turnId: z.string(),
  event: z.enum(['mood', 'gesture', 'state']),
  value: z.string(),
  seconds: z.number().optional(),
});

export const ToolCallSchema = z.object({
  type: z.literal('tool.call'),
  turnId: z.string(),
  callId: z.string(),
  name: z.string(),
  args: z.record(z.unknown()),
});

export const ToolApprovalRequestSchema = z.object({
  type: z.literal('tool.approval.request'),
  callId: z.string(),
  name: z.string(),
  tier: z.enum(['T1', 'T2']),
  summary: z.string(),
  args: z.record(z.unknown()),
  timeoutMs: z.number().default(60000),
});

export const ToolResultSchema = z.object({
  type: z.literal('tool.result'),
  callId: z.string(),
  ok: z.boolean(),
  error: z.string().optional(),
});

export const TurnEndSchema = z.object({
  type: z.literal('turn.end'),
  turnId: z.string(),
  reason: z.enum(['complete', 'interrupted', 'error']),
  timing: z
    .object({
      stt_ms: z.number().optional(),
      llm_first_token_ms: z.number().optional(),
      tts_ms: z.number().optional(),
      total_ms: z.number().optional(),
    })
    .optional(),
});

export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  code: z.enum(['STT_FAILED', 'TTS_FAILED', 'LLM_FAILED', 'UNAUTHORIZED', 'RATE_LIMITED']),
  message: z.string(),
  turnId: z.string().optional(),
});

export const ServerMessageSchema = z.discriminatedUnion('type', [
  SessionReadySchema,
  TurnTranscriptSchema,
  AssistantTextDeltaSchema,
  AssistantSpeechHeaderSchema,
  AvatarEventSchema,
  ToolCallSchema,
  ToolApprovalRequestSchema,
  ToolResultSchema,
  TurnEndSchema,
  ErrorEventSchema,
]);

export type SessionReady = z.infer<typeof SessionReadySchema>;
export type TurnTranscript = z.infer<typeof TurnTranscriptSchema>;
export type AssistantTextDelta = z.infer<typeof AssistantTextDeltaSchema>;
export type AssistantSpeechHeader = z.infer<typeof AssistantSpeechHeaderSchema>;
export type AvatarEvent = z.infer<typeof AvatarEventSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type ToolApprovalRequest = z.infer<typeof ToolApprovalRequestSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type TurnEnd = z.infer<typeof TurnEndSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

