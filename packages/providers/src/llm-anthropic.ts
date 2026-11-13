import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, LlmEvent, Msg, ToolDef } from '@companion/core';

export class AnthropicLlm implements LlmProvider {
  private client: Anthropic;
  private model: string;

  constructor(opts: { apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model ?? 'claude-3-5-haiku-20241022';
  }

  async *stream(req: {
    system: string;
    messages: Msg[];
    tools: ToolDef[];
    signal: AbortSignal;
  }): AsyncIterable<LlmEvent> {
    const anthropicMessages = req.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user' as const,
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: m.toolCallId ?? '',
              content: m.content,
            },
          ],
        };
      }
      return {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      };
    });

    const tools = req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
    }));

    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: 1024,
      system: req.system,
      messages: anthropicMessages,
      ...(tools.length > 0 ? { tools } : {}),
    };

    const stream = this.client.messages.stream(params, { signal: req.signal });

    for await (const event of stream) {
      if (req.signal.aborted) break;

      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { kind: 'text_delta', text: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          // Accumulate tool input — handled by tool_use block
        }
      } else if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          // Will be yielded as tool_call when complete (message_stop)
        }
      } else if (event.type === 'message_stop') {
        const finalMsg = await stream.finalMessage();
        for (const block of finalMsg.content) {
          if (block.type === 'tool_use') {
            yield {
              kind: 'tool_call',
              callId: block.id,
              name: block.name,
              args: block.input as Record<string, unknown>,
            };
          }
        }
        yield {
          kind: 'usage',
          inputTokens: finalMsg.usage.input_tokens,
          outputTokens: finalMsg.usage.output_tokens,
        };
        const stopReason =
          finalMsg.stop_reason === 'tool_use'
            ? 'tool_use'
            : finalMsg.stop_reason === 'max_tokens'
              ? 'max_tokens'
              : 'end_turn';
        yield { kind: 'end', stopReason };
      }
    }
  }
}

