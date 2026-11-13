import { describe, it, expect } from 'vitest';
import { ClientMessageSchema, ServerMessageSchema } from './index.js';

describe('Protocol schemas', () => {
  it('validates client input.text message', () => {
    const valid = {
      type: 'input.text',
      turnId: 't_123',
      text: 'Hello assistant',
    };
    const parsed = ClientMessageSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects client input.text message with empty text', () => {
    const invalid = {
      type: 'input.text',
      turnId: 't_123',
      text: '',
    };
    const parsed = ClientMessageSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates server assistant.text.delta message', () => {
    const valid = {
      type: 'assistant.text.delta',
      turnId: 't_123',
      text: 'I am here to help.',
    };
    const parsed = ServerMessageSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('validates server tool.approval.request message', () => {
    const valid = {
      type: 'tool.approval.request',
      callId: 'c_1',
      name: 'calendar_create_event',
      tier: 'T2',
      summary: 'Create dentist appointment',
      args: { title: 'Dentist' },
      timeoutMs: 60000,
    };
    const parsed = ServerMessageSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});

