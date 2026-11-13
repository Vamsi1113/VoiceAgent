import type { SttProvider, TtsProvider, Voice } from '@companion/core';

/**
 * VoiceStudio STT provider.
 * Calls POST /v1/audio/transcriptions with multipart form data.
 * Gateway holds the API key — this provider is used only server-side.
 */
export class VoiceStudioStt implements SttProvider {
  constructor(
    private baseUrl: string,
    private apiKey?: string,
    private defaultModel: string = 'whisper-1',
  ) {}

  async transcribe(
    wav: Uint8Array,
    opts: { language?: string },
  ): Promise<{ text: string; language?: string }> {
    const form = new FormData();
    const blob = new Blob([wav.buffer as ArrayBuffer], { type: 'audio/wav' });
    form.append('file', blob, 'utterance.wav');
    form.append('model', this.defaultModel);
    if (opts.language) form.append('language', opts.language);

    const headers: Record<string, string> = {};
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      headers,
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`STT_FAILED: ${res.status} ${body}`);
    }

    const json = (await res.json()) as { text: string };
    return { text: json.text };
  }
}

/**
 * VoiceStudio TTS provider.
 * Calls POST /v1/audio/speech and returns WAV bytes.
 */
export class VoiceStudioTts implements TtsProvider {
  constructor(
    private baseUrl: string,
    private apiKey?: string,
  ) {}

  async synthesize(
    text: string,
    opts: { voiceId: string; language?: string; signal: AbortSignal },
  ): Promise<{ audio: Uint8Array; mimeType: 'audio/wav' }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    let res = await fetch(`${this.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'tts-1',
        voice: opts.voiceId,
        input: text,
        response_format: 'wav',
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      // If a custom voice ID failed (e.g. not found), retry with 'alloy' as a resilient fallback
      if (opts.voiceId !== 'alloy') {
        const fallbackRes = await fetch(`${this.baseUrl}/v1/audio/speech`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: 'tts-1',
            voice: 'alloy',
            input: text,
            response_format: 'wav',
          }),
          signal: opts.signal,
        });

        if (fallbackRes.ok) {
          const buffer = await fallbackRes.arrayBuffer();
          return { audio: new Uint8Array(buffer), mimeType: 'audio/wav' };
        }
      }

      throw new Error(`TTS_FAILED: ${res.status} ${errBody}`);
    }

    const buffer = await res.arrayBuffer();
    return { audio: new Uint8Array(buffer), mimeType: 'audio/wav' };
  }

  async listVoices(): Promise<Voice[]> {
    const headers: Record<string, string> = {};
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    let res = await fetch(`${this.baseUrl}/v1/audio/voices`, { headers }).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(`${this.baseUrl}/v1/voices`, { headers }).catch(() => null);
    }
    if (!res || !res.ok) return [];

    try {
      const json = (await res.json()) as any;
      const list = Array.isArray(json) ? json : json.voices ?? json.data ?? [];
      return list.map((v: any) => ({
        id: v.id ?? v.voice_id ?? v.name,
        name: v.name ?? v.id,
        ...(v.language !== undefined ? { language: v.language } : {}),
      }));
    } catch {
      return [];
    }
  }
}

