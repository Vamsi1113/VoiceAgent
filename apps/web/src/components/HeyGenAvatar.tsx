import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
  TaskMode,
} from '@heygen/streaming-avatar';
import styles from './HeyGenAvatar.module.css';

export interface HeyGenAvatarHandle {
  speak: (text: string) => Promise<void>;
  interrupt: () => Promise<void>;
  isActive: () => boolean;
}

interface Props {
  token: string;
  onAvatarStateChange?: (state: 'offline' | 'connecting' | 'live' | 'speaking') => void;
}

export const HeyGenAvatar = forwardRef<HeyGenAvatarHandle, Props>(function HeyGenAvatar(
  { token, onAvatarStateChange },
  ref,
) {
  const [status, setStatus] = useState<'offline' | 'connecting' | 'live' | 'speaking'>('offline');
  const [error, setError] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string>('default');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateStatus = useCallback((s: 'offline' | 'connecting' | 'live' | 'speaking') => {
    setStatus(s);
    onAvatarStateChange?.(s);
  }, [onAvatarStateChange]);

  // Clean up timer
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Start timer to track credit usage
  const startTimer = () => {
    stopTimer();
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  // Clean up session
  const stopSession = useCallback(async () => {
    stopTimer();
    updateStatus('offline');
    try {
      if (avatarRef.current) {
        await avatarRef.current.stopAvatar();
      }
    } catch (e) {
      console.warn('[HeyGen] Error stopping avatar:', e);
    } finally {
      avatarRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [updateStatus]);

  // Start streaming avatar session
  const startSession = async () => {
    setError(null);
    updateStatus('connecting');

    try {
      // 1. Fetch HeyGen session token from our gateway
      const res = await fetch('/v1/heygen/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(errJson.error?.message || `Failed to create HeyGen token (${res.status})`);
      }

      const { token: heygenToken, avatarId: configuredAvatarId } = (await res.json()) as {
        token: string;
        avatarId?: string;
      };

      const targetAvatar = configuredAvatarId || avatarId || 'default';

      // 2. Initialize HeyGen StreamingAvatar SDK
      const avatar = new StreamingAvatar({ token: heygenToken });
      avatarRef.current = avatar;

      // 3. Setup event listeners
      avatar.on(StreamingEvents.STREAM_READY, (event: CustomEvent<MediaStream>) => {
        if (videoRef.current && event.detail) {
          videoRef.current.srcObject = event.detail;
          videoRef.current.play().catch((pErr) => console.warn('[HeyGen] Video play failed:', pErr));
        }
        updateStatus('live');
        startTimer();
      });

      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        updateStatus('speaking');
      });

      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        updateStatus('live');
      });

      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        stopSession();
      });

      // 4. Start avatar with WebRTC stream
      await avatar.createStartAvatar({
        quality: AvatarQuality.Low, // Low quality is recommended to save latency and bandwidth
        avatarName: targetAvatar,
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      updateStatus('offline');
      stopSession();
    }
  };

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    speak: async (text: string) => {
      if (!avatarRef.current || status === 'offline' || status === 'connecting') return;
      try {
        await avatarRef.current.speak({
          text,
          task_type: TaskType.REPEAT,
          taskMode: TaskMode.SYNC,
        });
      } catch (err) {
        console.warn('[HeyGen] speak error:', err);
      }
    },
    interrupt: async () => {
      if (!avatarRef.current) return;
      try {
        await avatarRef.current.interrupt();
      } catch (err) {
        console.warn('[HeyGen] interrupt error:', err);
      }
    },
    isActive: () => status === 'live' || status === 'speaking',
  }), [status]);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.videoWrapper}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={styles.video}
          style={{ display: status === 'live' || status === 'speaking' ? 'block' : 'none' }}
        />

        {status === 'offline' && (
          <div className={styles.placeholder}>
            <span className={styles.avatarIcon}>🎭</span>
            <div className={styles.placeholderText}>HeyGen Interactive Live Avatar</div>
            <div className={styles.placeholderSubtext}>
              Click <strong>&quot;Start Avatar&quot;</strong> to start live video streaming and lip-sync with your AI.
            </div>
          </div>
        )}

        {status === 'connecting' && (
          <div className={styles.placeholder}>
            <span className={styles.avatarIcon}>⏳</span>
            <div className={styles.placeholderText}>Connecting to HeyGen WebRTC Stream…</div>
            <div className={styles.placeholderSubtext}>Starting live session. Please wait a moment.</div>
          </div>
        )}

        {/* Live Status Overlay */}
        <div className={styles.statusBar}>
          <div className={styles.badge}>
            <span className={`${styles.dot} ${styles[status]}`} />
            {status === 'offline' && 'Offline'}
            {status === 'connecting' && 'Connecting…'}
            {status === 'live' && 'Live (Listening)'}
            {status === 'speaking' && 'Speaking…'}
          </div>

          {(status === 'live' || status === 'speaking') && (
            <div className={styles.timerBadge} title="Active session time (charged per minute on HeyGen)">
              ⏱ {formatTime(elapsedSeconds)}
            </div>
          )}
        </div>
      </div>

      {error && <div className={styles.errorBanner}>⚠️ {error}</div>}

      <div className={styles.controls}>
        <div className={styles.btnGroup}>
          {status === 'offline' ? (
            <button className={styles.startBtn} onClick={startSession}>
              ▶ Start Avatar
            </button>
          ) : (
            <button className={styles.stopBtn} onClick={stopSession} title="Stop avatar to conserve your HeyGen credits">
              ⏹ End Avatar
            </button>
          )}
        </div>

        <div className={styles.creditNotice}>
          💡 <span>Tip: Click <strong>End Avatar</strong> when idle to save your 10 free credits!</span>
        </div>
      </div>
    </div>
  );
});

