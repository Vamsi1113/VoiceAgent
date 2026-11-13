// ── Provider interfaces ───────────────────────────────────────────────────────
// These are the stable contracts. Swapping any provider must NOT touch core or other providers.

export type Mood = 'neutral' | 'happy' | 'angry' | 'sad' | 'fear' | 'disgust' | 'love' | 'sleep';
export type Gesture =
  | 'handup'
  | 'index'
  | 'ok'
  | 'thumbup'
  | 'thumbdown'
  | 'side'
  | 'shrug';

export interface LlmTextDelta {
  kind: 'text_delta';
  text: string;
}
export interface LlmToolCall {
  kind: 'tool_call';
  callId: string;
  name: string;
  args: Record<string, unknown>;
}
export interface LlmUsage {
  kind: 'usage';
  inputTokens: number;
  outputTokens: number;
}
export interface LlmEnd {
  kind: 'end';
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

export type LlmEvent = LlmTextDelta | LlmToolCall | LlmUsage | LlmEnd;

export interface Msg {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON schema
}

export interface LlmProvider {
  stream(req: {
    system: string;
    messages: Msg[];
    tools: ToolDef[];
    signal: AbortSignal;
  }): AsyncIterable<LlmEvent>;
}

export interface SttProvider {
  transcribe(
    wav: Uint8Array,
    opts: { language?: string },
  ): Promise<{ text: string; language?: string }>;
}

export interface Voice {
  id: string;
  name: string;
  language?: string;
}

export interface TtsProvider {
  synthesize(
    text: string,
    opts: { voiceId: string; language?: string; signal: AbortSignal },
  ): Promise<{ audio: Uint8Array; mimeType: 'audio/wav' }>;
  listVoices(): Promise<Voice[]>;
}

