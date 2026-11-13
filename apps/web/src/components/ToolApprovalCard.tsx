import styles from './ToolApprovalCard.module.css';

interface Approval {
  callId: string;
  name: string;
  tier: 'T1' | 'T2';
  summary: string;
  args: Record<string, unknown>;
}

interface Props {
  approval: Approval;
  onApprove: () => void;
  onDeny: () => void;
}

export default function ToolApprovalCard({ approval, onApprove, onDeny }: Props) {
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.tier}>
          {approval.tier === 'T2' ? '⚠️ Sensitive Action — Explicit Approval Required' : '📝 Action Needs Approval'}
        </div>
        <h2 className={styles.name}>{approval.name}</h2>
        <p className={styles.summary}>{approval.summary}</p>
        <details className={styles.details}>
          <summary>Show arguments</summary>
          <pre className={styles.args}>{JSON.stringify(approval.args, null, 2)}</pre>
        </details>
        <div className={styles.actions}>
          <button className={styles.deny} onClick={onDeny}>
            Deny
          </button>
          <button className={styles.approve} onClick={onApprove}>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

