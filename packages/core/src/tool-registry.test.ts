import { describe, it, expect } from 'vitest';
import { ToolRegistry, DefaultApprovalPolicy } from './tool-registry.js';

describe('ToolRegistry', () => {
  it('registers and retrieves tools with correct risk tiers', () => {
    const registry = new ToolRegistry();
    registry.register({
      tier: 'T0',
      def: {
        name: 'test_t0',
        description: 'Read only tool',
        inputSchema: { type: 'object' },
      },
      execute: async () => 'ok',
    });

    registry.register({
      tier: 'T2',
      def: {
        name: 'test_t2',
        description: 'Sensitive tool',
        inputSchema: { type: 'object' },
      },
      execute: async () => 'sensitive_ok',
    });

    expect(registry.getTier('test_t0')).toBe('T0');
    expect(registry.getTier('test_t2')).toBe('T2');
    expect(registry.listDefs().length).toBe(2);
  });
});

describe('DefaultApprovalPolicy', () => {
  it('auto-approves T0 and forbids auto-approving T1 and T2', () => {
    const policy = new DefaultApprovalPolicy();
    expect(policy.canAutoApprove('T0')).toBe(true);
    expect(policy.canAutoApprove('T1')).toBe(false);
    expect(policy.canAutoApprove('T2')).toBe(false);
  });
});

