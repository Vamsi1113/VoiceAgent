import type { LlmProvider, LlmEvent, Msg, ToolDef } from '@companion/core';

export class OpenAICompatLlm implements LlmProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(opts: { baseUrl: string; apiKey?: string; model?: string }) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey || 'ollama';
    this.model = opts.model || 'llama3.2';
  }

  async *stream(req: {
    system: string;
    messages: Msg[];
    tools: ToolDef[];
    signal: AbortSignal;
  }): AsyncIterable<LlmEvent> {
    const messages = [
      { role: 'system', content: req.system },
      ...req.messages.map((m) => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
      })),
    ];

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: true,
    };

    if (req.tools.length > 0) {
      body['tools'] = req.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    // OpenRouter requires these extra headers for routing & rate-limit attribution
    if (this.baseUrl.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'http://localhost:5173';
      headers['X-Title'] = 'Companion Voice Agent';
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`LLM_FAILED: ${res.status} ${errText}`);
    }

    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (!req.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') {
            yield { kind: 'end', stopReason: 'end_turn' };
            return;
          }

          try {
            const parsed = JSON.parse(dataStr) as {
              choices?: Array<{
                delta?: {
                  content?: string;
                  tool_calls?: Array<{
                    id?: string;
                    function?: { name?: string; arguments?: string };
                  }>;
                };
                finish_reason?: string;
              }>;
            };

            const choice = parsed.choices?.[0];
            const content = choice?.delta?.content;
            if (content) {
              yield { kind: 'text_delta', text: content };
            }

            if (choice?.finish_reason === 'stop') {
              yield { kind: 'end', stopReason: 'end_turn' };
            }
          } catch {
            // Ignore parse errors on partial chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { kind: 'end', stopReason: 'end_turn' };
  }
}

