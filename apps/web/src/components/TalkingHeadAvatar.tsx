/**
 * TalkingHeadAvatar.tsx
 * 3D talking avatar powered by TalkingHead (MIT) + HeadAudio (MIT).
 * Audio-driven lip-sync: WAV AudioBuffer → TalkingHead.speakAudio()
 */
import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from 'react';
import styles from './TalkingHeadAvatar.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface TalkingHeadAvatarHandle {
  /** Queue an AudioBuffer for lip-synced speech. */
  speakBuffer(buffer: AudioBuffer): void;
  /** Set the avatar's visible mood/state. */
  setState(state: AvatarState): void;
  /** Stop current speech and clear queue. */
  stopSpeaking(): void;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Whether the avatar section is shown at all */
  visible?: boolean;
}

const MOOD_MAP: Record<AvatarState, string> = {
  idle: 'neutral',
  listening: 'happy',
  thinking: 'sad',
  speaking: 'neutral',
};

const TalkingHeadAvatar = forwardRef<TalkingHeadAvatarHandle, Props>(
  ({ visible = true }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headRef = useRef<any>(null);
    const [avatarState, setAvatarState] = useState<AvatarState>('idle');
    const [loadStatus, setLoadStatus] = useState<
      'loading' | 'ready' | 'error'
    >('loading');
    const [loadMsg, setLoadMsg] = useState('Loading 3D avatar…');

    // ── Expose imperative API ────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      speakBuffer(buffer: AudioBuffer) {
        const head = headRef.current;
        if (!head) return;
        try {
          // speakAudio({ audio: AudioBuffer }) — TalkingHead plays audio and
          // drives lip-sync from audio amplitude via its internal AudioAnalyzer.
          head.speakAudio({ audio: buffer });
          setAvatarState('speaking');
        } catch (e) {
          console.warn('[TalkingHead] speakAudio error:', e);
        }
      },
      setState(state: AvatarState) {
        setAvatarState(state);
        const head = headRef.current;
        if (!head) return;
        try {
          head.setMood(MOOD_MAP[state]);
        } catch {}
      },
      stopSpeaking() {
        const head = headRef.current;
        if (!head) return;
        try {
          head.stopSpeaking();
        } catch {}
        setAvatarState('idle');
      },
    }));

    // ── Load TalkingHead on mount ────────────────────────────────────────────
    useEffect(() => {
      if (!visible) return;
      let cancelled = false;

      async function init() {
        try {
          setLoadMsg('Loading TalkingHead module…');

          // Execute native browser dynamic import via Function constructor
          // so Vite's transform pipeline does not intercept or block public/ folder static files.
          const importNative = new Function('url', 'return import(url)');
          const mod = await importNative('/lib/talkinghead.mjs');
          if (cancelled) return;

          const TalkingHead = mod.TalkingHead ?? mod.default;
          if (!TalkingHead) throw new Error('TalkingHead class not found in module');

          if (!containerRef.current) throw new Error('Container not ready');

          setLoadMsg('Initialising 3D scene…');

          const head = new TalkingHead(containerRef.current, {
            ttsEndpoint: null,          // We supply audio ourselves — no built-in TTS
            lipsyncLang: 'en',
            lipsyncModules: ['en'],
            cameraView: 'upper',        // Upper-body portrait shot
            modelFPS: 30,
            avatarMood: 'neutral',
            lightAmbientIntensity: 2,
            lightDirectIntensity: 25,
          });

          setLoadMsg('Loading avatar model…');
          await head.showAvatar(
            { url: '/avatars/nova.glb', lipsyncLang: 'en' },
            (url: string, ev: { loaded: number; total: number }) => {
              if (ev.total > 0) {
                const pct = Math.round((ev.loaded / ev.total) * 100);
                setLoadMsg(`Loading avatar… ${pct}%`);
              }
            },
          );

          if (cancelled) {
            head.stop?.();
            return;
          }

          headRef.current = head;
          setLoadStatus('ready');
          setAvatarState('idle');
        } catch (err) {
          if (!cancelled) {
            console.error('[TalkingHead] Init failed:', err);
            setLoadStatus('error');
            setLoadMsg(
              err instanceof Error ? err.message : 'Avatar failed to load',
            );
          }
        }
      }

      init();

      return () => {
        cancelled = true;
        try {
          headRef.current?.stop?.();
        } catch {}
        headRef.current = null;
      };
    }, [visible]);

    if (!visible) return null;

    return (
      <div className={styles.wrapper}>
        {/* Three.js renders into this div */}
        <div ref={containerRef} className={styles.canvas} />

        {/* Overlay badges */}
        {loadStatus === 'loading' && (
          <div className={styles.overlay}>
            <div className={styles.spinner} />
            <span>{loadMsg}</span>
          </div>
        )}
        {loadStatus === 'error' && (
          <div className={styles.overlay}>
            <span className={styles.errorIcon}>⚠️</span>
            <span>{loadMsg}</span>
          </div>
        )}
        {loadStatus === 'ready' && (
          <div className={styles.stateBadge} data-state={avatarState}>
            {avatarState === 'idle' && '😶'}
            {avatarState === 'listening' && '👂'}
            {avatarState === 'thinking' && '💭'}
            {avatarState === 'speaking' && '🗣️'}
          </div>
        )}
      </div>
    );
  },
);

TalkingHeadAvatar.displayName = 'TalkingHeadAvatar';
export default TalkingHeadAvatar;
