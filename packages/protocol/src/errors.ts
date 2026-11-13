// Typed error codes shared across the system
export type ErrorCode =
  | 'STT_FAILED'
  | 'TTS_FAILED'
  | 'LLM_FAILED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

