import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './Chat.module.css';
import MessageList from '../components/MessageList.js';
import TextInput from '../components/TextInput.js';
import ToolApprovalCard from '../components/ToolApprovalCard.js';
import TalkingHeadAvatar, {
  type TalkingHeadAvatarHandle,
} from '../components/TalkingHeadAvatar.js';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface PendingApproval {
  callId: string;
  name: string;
  tier: 'T1' | 'T2';
  summary: string;
  args: Record<string, unknown>;
}

interface AssistantInfo {
  name: string;
  voiceId: string;
  language: string;
}

type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

function generateId(): string {
  return Math.random().toString(36).slice(2);
}

export default function Chat({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('companion_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }>;
        return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    } catch {}
    return [];
  });
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [assistant, setAssistant] = useState<AssistantInfo>({ name: 'Companion', voiceId: 'b8641c4d', language: 'en-IN' });
  const [isThinking, setIsThinking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const currentTurnRef = useRef<string | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 3D Avatar ref
  const avatarRef = useRef<TalkingHeadAvatarHandle | null>(null);

  // Persist messages in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('companion_chat_history', JSON.stringify(messages.slice(-50)));
    } catch {}
  }, [messages]);

  const addMessage = useCallback((role: Message['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: generateId(), role, content, timestamp: new Date() },
    ]);
  }, []);

  const appendToLastAssistant = useCallback((text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, content: last.content + text }];
      }
      return [...prev, { id: generateId(), role: 'assistant', content: text, timestamp: new Date() }];
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem('companion_chat_history');
    setMessages([]);
  }, []);

  const connect = useCallback(() => {
    const wsUrl = `ws://localhost:3001/v1/session?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setWsStatus('connecting');

    ws.onopen = () => {
      setWsStatus('connected');
      ws.send(JSON.stringify({
        type: 'session.start',
        clientType: 'web',
        deviceId: 'web-' + generateId(),
        locale: 'en-IN',
        capabilities: { audio: ['audio/wav'], avatar: false },
      }));
    };

    ws.onmessage = (evt) => {
      if (typeof evt.data === 'string') {
        const msg = JSON.parse(evt.data) as Record<string, unknown>;
        handleServerMessage(msg);
      } else {
        // Binary WAV audio from VoiceStudio TTS → decode → TalkingHead lip-sync
        handleAudioBlob(evt.data as Blob);
      }
    };

    ws.onclose = (evt: CloseEvent) => {
      setWsStatus('disconnected');
      setIsThinking(false);
      avatarRef.current?.setState('idle');
      // If code is 4001, token is invalid/expired — do not loop reconnect!
      if (evt.code === 4001) {
        onLogout();
        return;
      }
      // Reconnect with backoff
      reconnectTimer.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = () => {
      setWsStatus('error');
    };
  }, [token, onLogout]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  // ── AudioContext for decoding WAV blobs ───────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Queue of Blobs to decode sequentially
  const audioQueueRef = useRef<Blob[]>([]);
  const processingAudioRef = useRef(false);

  function getAudioCtx(): AudioContext {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    return audioCtxRef.current;
  }

  // Unlock / resume AudioContext on user gesture
  const unlockAudio = useCallback(() => {
    try {
      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {}
  }, []);

  // Decode and hand off one WAV blob to TalkingHead
  async function processNextAudio() {
    if (processingAudioRef.current) return;
    const blob = audioQueueRef.current.shift();
    if (!blob) return;

    processingAudioRef.current = true;
    try {
      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

      const wavBlob = blob.type ? blob : new Blob([blob], { type: 'audio/wav' });
      const arrayBuf = await wavBlob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf);

      // Hand off to TalkingHead — it queues audio + drives lip-sync internally
      avatarRef.current?.speakBuffer(decoded);
    } catch (err) {
      console.warn('[Companion] Audio decode failed:', err);
    } finally {
      processingAudioRef.current = false;
      // Process next in queue
      if (audioQueueRef.current.length > 0) {
        processNextAudio();
      }
    }
  }

  const handleAudioBlob = useCallback((blob: Blob) => {
    audioQueueRef.current.push(blob);
    processNextAudio();
  }, []);

  const testAudio = useCallback(() => {
    unlockAudio();
    try {
      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      addMessage('system', '🔊 Speaker test sound played.');
    } catch {
      addMessage('system', '❌ Browser audio is blocked. Please click anywhere to allow audio.');
    }
  }, [unlockAudio, addMessage]);

  const handleServerMessage = useCallback((msg: Record<string, unknown>) => {
    const type = msg['type'] as string;

    if (type === 'session.ready') {
      const a = msg['assistant'] as AssistantInfo;
      setAssistant(a);
      addMessage('system', `Connected to ${a.name}. Say hello!`);
      avatarRef.current?.setState('idle');
    } else if (type === 'turn.transcript') {
      // User transcript — no-op
    } else if (type === 'assistant.text.delta') {
      setIsThinking(false);
      appendToLastAssistant(msg['text'] as string);
      // Avatar enters thinking while text streams (audio will arrive shortly after)
      avatarRef.current?.setState('thinking');
    } else if (type === 'assistant.speech') {
      // Server signals an audio chunk is about to arrive (binary message follows)
      // No action needed — binary handler below will receive it
    } else if (type === 'assistant.speech_text') {
      // Only fired in non-VoiceStudio mode — not expected here but handle gracefully
      console.debug('[Companion] speech_text (unexpected):', msg['text']);
    } else if (type === 'tts.error') {
      addMessage('system', `⚠️ Speech warning: ${msg['message'] as string}`);
    } else if (type === 'tool.call') {
      addMessage('system', `🔧 Calling tool: ${msg['name'] as string}`);
    } else if (type === 'tool.approval.request') {
      setPendingApproval({
        callId: msg['callId'] as string,
        name: msg['name'] as string,
        tier: msg['tier'] as 'T1' | 'T2',
        summary: msg['summary'] as string,
        args: msg['args'] as Record<string, unknown>,
      });
    } else if (type === 'tool.result') {
      const ok = msg['ok'] as boolean;
      addMessage('system', ok ? '✅ Tool completed' : `❌ Tool failed: ${msg['error'] ?? 'Unknown'}`);
    } else if (type === 'turn.end') {
      setIsThinking(false);
      currentTurnRef.current = null;
      // Avatar returns to idle after a short delay (audio may still be playing)
      setTimeout(() => avatarRef.current?.setState('idle'), 2000);
    } else if (type === 'error') {
      setIsThinking(false);
      avatarRef.current?.setState('idle');
      addMessage('system', `Error: ${msg['message'] as string}`);
    }
  }, [addMessage, appendToLastAssistant]);

  const sendText = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    // Stop any ongoing avatar speech when user sends a new message
    avatarRef.current?.stopSpeaking();
    // Unlock audio context on user action
    unlockAudio();
    const turnId = 't_' + generateId();
    currentTurnRef.current = turnId;
    setIsThinking(true);
    avatarRef.current?.setState('thinking');
    addMessage('user', text);
    // Add empty assistant message to stream into
    setMessages((prev) => [...prev, { id: generateId(), role: 'assistant', content: '', timestamp: new Date() }]);
    wsRef.current.send(JSON.stringify({ type: 'input.text', turnId, text }));
  }, [addMessage, unlockAudio]);

  const handleApproval = useCallback((decision: 'approve' | 'deny') => {
    if (!pendingApproval || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'tool.approval',
      callId: pendingApproval.callId,
      decision,
    }));
    setPendingApproval(null);
  }, [pendingApproval]);

  return (
    <div className={styles.layout}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.avatar}>🤖</span>
          <div>
            <h1 className={styles.name}>{assistant.name}</h1>
            <span className={`${styles.status} ${styles[wsStatus]}`}>
              {wsStatus === 'connected' ? '● Online' : wsStatus === 'connecting' ? '○ Connecting…' : '○ Offline'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className={styles.logoutBtn} onClick={testAudio} title="Test speaker output">
            🔊 Test Audio
          </button>
          {messages.length > 0 && (
            <button className={styles.logoutBtn} onClick={clearHistory} title="Clear conversation history">
              Clear
            </button>
          )}
          <button className={styles.logoutBtn} onClick={onLogout}>
            Disconnect
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* TalkingHead 3D Avatar */}
        <TalkingHeadAvatar ref={avatarRef} visible={true} />

        {/* Conversation Messages */}
        <MessageList messages={messages} isThinking={isThinking} />
      </main>

      {/* Tool approval card */}
      {pendingApproval && (
        <ToolApprovalCard
          approval={pendingApproval}
          onApprove={() => handleApproval('approve')}
          onDeny={() => handleApproval('deny')}
        />
      )}

      {/* Input */}
      <footer className={styles.footer}>
        <TextInput
          onSend={sendText}
          disabled={wsStatus !== 'connected' || isThinking}
        />
      </footer>
    </div>
  );
}
