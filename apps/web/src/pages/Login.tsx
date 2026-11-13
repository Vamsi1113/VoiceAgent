import { useState } from 'react';
import styles from './Login.module.css';

interface Props {
  onLogin: (token: string) => void;
}

export default function Login({ onLogin }: Props) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError('');

    try {
      // Verify the token is valid by calling /v1/assistant
      const res = await fetch('/v1/assistant', {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (!res.ok) {
        setError('Invalid token. Please check and try again.');
        return;
      }
      onLogin(token.trim());
    } catch {
      setError('Could not connect to the gateway. Make sure it is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>🤖</div>
        <h1 className={styles.title}>Companion</h1>
        <p className={styles.subtitle}>Personal AI Voice Agent</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label} htmlFor="token">
            Access Token
          </label>
          <input
            id="token"
            type="password"
            className={styles.input}
            placeholder="Paste your access token…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
          <p className={styles.hint}>
            Run <code>pnpm run pair:first</code> in the gateway to get a token.
          </p>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.button} disabled={loading || !token.trim()}>
            {loading ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}

