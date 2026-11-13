import { z } from 'zod';

// ── Client → Server WebSocket messages ───────────────────────────────────────

export const SessionStartSchema = z.object({
  type: z.literal('session.start'),
  clientType: z.enum(['web', 'desktop', 'android', 'embed']),
  deviceId: z.string(),
  locale: z.string().default('en-IN'),
  capabilities: z.object({
    audio: z.array(z.string()).default(['audio/wav']),
    avatar: z.boolean().default(false),
  }),
});

export const InputTextSchema = z.object({
  type: z.literal('input.text'),
  turnId: z.string(),
  text: z.string().min(1).max(4000),
});

export const InputAudioBeginSchema = z.object({
  type: z.literal('input.audio.begin'),
  turnId: z.string(),
  mimeType: z.string().default('audio/wav'),
  sampleRate: z.number().default(16000),
});

export const InputAudioEndSchema = z.object({
  type: z.literal('input.audio.end'),
  turnId: z.string(),
});

export const InterruptSchema = z.object({
  type: z.literal('interrupt'),
  turnId: z.string(),
});

export const ToolApprovalSchema = z.object({
  type: z.literal('tool.approval'),
  callId: z.string(),
  decision: z.enum(['approve', 'deny']),
});

export const ClientMessageSchema = z.discriminatedUnion('type', [
  SessionStartSchema,
  InputTextSchema,
  InputAudioBeginSchema,
  InputAudioEndSchema,
  InterruptSchema,
  ToolApprovalSchema,
]);

export type SessionStart = z.infer<typeof SessionStartSchema>;
export type InputText = z.infer<typeof InputTextSchema>;
export type InputAudioBegin = z.infer<typeof InputAudioBeginSchema>;
export type InputAudioEnd = z.infer<typeof InputAudioEndSchema>;
export type Interrupt = z.infer<typeof InterruptSchema>;
export type ToolApproval = z.infer<typeof ToolApprovalSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

