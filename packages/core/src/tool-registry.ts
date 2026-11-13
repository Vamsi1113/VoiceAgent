import type { ToolDef } from './providers/interfaces.js';

// ── Risk tiers ────────────────────────────────────────────────────────────────
export type RiskTier = 'T0' | 'T1' | 'T2';

export interface ToolRegistration {
  def: ToolDef;
  tier: RiskTier;
  execute: (args: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolRegistration>();

  register(reg: ToolRegistration): void {
    this.tools.set(reg.def.name, reg);
  }

  get(name: string): ToolRegistration | undefined {
    return this.tools.get(name);
  }

  listDefs(): ToolDef[] {
    return [...this.tools.values()].map((r) => r.def);
  }

  getTier(name: string): RiskTier | undefined {
    return this.tools.get(name)?.tier;
  }
}

// ── Approval policy ───────────────────────────────────────────────────────────
export interface ApprovalRequest {
  callId: string;
  toolName: string;
  tier: RiskTier;
  args: Record<string, unknown>;
}

export type ApprovalDecision = 'approved' | 'denied' | 'timeout';

export interface ApprovalPolicy {
  /** Returns whether auto-approval is possible (T0 always yes; T1 may be yes; T2 always no). */
  canAutoApprove(tier: RiskTier): boolean;
  /** Request a human decision. Must resolve within timeoutMs. */
  requestApproval(
    req: ApprovalRequest,
    timeoutMs: number,
  ): Promise<ApprovalDecision>;
}

export class DefaultApprovalPolicy implements ApprovalPolicy {
  private pendingApprovals = new Map<
    string,
    { resolve: (d: ApprovalDecision) => void; timer: ReturnType<typeof setTimeout> }
  >();

  canAutoApprove(tier: RiskTier): boolean {
    return tier === 'T0';
  }

  requestApproval(req: ApprovalRequest, timeoutMs: number): Promise<ApprovalDecision> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(req.callId);
        resolve('timeout');
      }, timeoutMs);
      this.pendingApprovals.set(req.callId, { resolve, timer });
    });
  }

  /** Called from the WebSocket handler when the user sends a tool.approval message. */
  submitDecision(callId: string, decision: 'approve' | 'deny'): void {
    const pending = this.pendingApprovals.get(callId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingApprovals.delete(callId);
    pending.resolve(decision === 'approve' ? 'approved' : 'denied');
  }
}

