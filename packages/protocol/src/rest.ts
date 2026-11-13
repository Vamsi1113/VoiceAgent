import { z } from 'zod';

// ── REST schemas ──────────────────────────────────────────────────────────────

export const PairingStartBodySchema = z.object({
  deviceName: z.string().min(1).max(100),
  clientType: z.enum(['web', 'desktop', 'android', 'embed']),
});

export const PairingApproveBodySchema = z.object({
  code: z.string().regex(/^\d{3}-\d{3}$/),
});

export const PairingCompleteBodySchema = z.object({
  pairingId: z.string(),
});

export const MemoryCreateBodySchema = z.object({
  text: z.string().min(1).max(2000),
  category: z.string().optional(),
});

export const MemoryUpdateBodySchema = z.object({
  text: z.string().min(1).max(2000),
});

export const TtsBodySchema = z.object({
  text: z.string().min(1).max(1000),
  voiceId: z.string().optional(),
});

export type PairingStartBody = z.infer<typeof PairingStartBodySchema>;
export type PairingApproveBody = z.infer<typeof PairingApproveBodySchema>;
export type PairingCompleteBody = z.infer<typeof PairingCompleteBodySchema>;
export type MemoryCreateBody = z.infer<typeof MemoryCreateBodySchema>;
export type MemoryUpdateBody = z.infer<typeof MemoryUpdateBodySchema>;
export type TtsBody = z.infer<typeof TtsBodySchema>;

