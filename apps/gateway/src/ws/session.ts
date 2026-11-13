import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type { Db, MemoryService } from '@companion/memory';
import { schema, eq, desc } from '@companion/memory';
import type { LlmProvider, SttProvider, TtsProvider, Persona } from '@companion/core';
import { runTurn, ToolRegistry, DefaultApprovalPolicy } from '@companion/core';
import type { Env } from '../env.js';
import { verifyToken } from '../auth.js';

interface WsDeps {
  db: Db;
  env: Env;
  llm: LlmProvider;
  stt: SttProvider;
  tts: TtsProvider;
  toolRegistry: ToolRegistry;
  approvalPolicy: DefaultApprovalPolicy;
  memoryService: MemoryService;
  persona: Persona & { avatarUrl?: string; defaultMood?: string };
}

function send(ws: WebSocket, msg: Record<string, unknown>) {
  if (ws.readyState === 1 /* OPEN */) {
    ws.send(JSON.stringify(msg));
  }
}

export async function sessionWsRoute(app: FastifyInstance, deps: WsDeps) {
  app.get(
    '/v1/session',
    { websocket: true },
    async (socket: WebSocket, req) => {
      // Auth: token in query string (browsers cannot set Authorization on WS upgrades)
      const url = new URL(req.url ?? '', `http://localhost`);
      const token = url.searchParams.get('token');

      if (!token) {
        send(socket, { type: 'error', code: 'UNAUTHORIZED', message: 'Missing token' });
        socket.close(4001, 'UNAUTHORIZED');
        return;
      }

      let deviceId: string;
      try {
        const payload = verifyToken(token, deps.env.JWT_SECRET);
        deviceId = payload.deviceId;
      } catch {
        send(socket, { type: 'error', code: 'UNAUTHORIZED', message: 'Invalid token' });
        socket.close(4001, 'UNAUTHORIZED');
        return;
      }

      // Create session
      const sessionId = randomUUID();
      const now = Date.now();
      await deps.db.insert(schema.sessions).values({
        id: sessionId,
        deviceId,
        startedAt: now,
      });

      // Update device lastSeenAt
      await deps.db.update(schema.devices).set({ lastSeenAt: now }).where(eq(schema.devices.id, deviceId));

      app.log.info({ sessionId, deviceId }, 'WS session started');

      send(socket, {
        type: 'session.ready',
        sessionId,
        assistant: {
          name: deps.persona.name,
          avatarUrl: deps.persona.avatarUrl ?? null,
          voiceId: deps.persona.voiceId,
        },
      });

      // State for audio accumulation
      let audioChunks: Buffer[] = [];
      let currentTurnId: string | null = null;
      let currentAbortController: AbortController | null = null;

      // Load previous conversation history from database so context persists across reconnects
      const recentRows = await deps.db
        .select()
        .from(schema.messages)
        .orderBy(desc(schema.messages.createdAt))
        .limit(20);

      const history: Array<{ role: 'user' | 'assistant'; content: string }> = recentRows
        .reverse()
        .filter((r) => r.role === 'user' || r.role === 'assistant')
        .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));

      socket.on('message', async (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
        if (isBinary) {
          // Binary audio chunk
          audioChunks.push(Buffer.from(data as Buffer));
          return;
        }

        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          send(socket, { type: 'error', code: 'VALIDATION_ERROR', message: 'Invalid JSON' });
          return;
        }

        const type = msg['type'] as string;

        if (type === 'session.start') {
          // Client confirms capabilities
          return;
        }

        if (type === 'input.audio.begin') {
          currentTurnId = msg['turnId'] as string;
          audioChunks = [];
          return;
        }

        if (type === 'input.audio.end') {
          const turnId = msg['turnId'] as string;
          currentTurnId = turnId;
          const audioBuffer = Buffer.concat(audioChunks);
          audioChunks = [];

          await processTurn(socket, turnId, sessionId, deviceId, audioBuffer, deps, history, app);
          return;
        }

        if (type === 'input.text') {
          const turnId = msg['turnId'] as string;
          const text = msg['text'] as string;
          currentTurnId = turnId;

          await processTurn(socket, turnId, sessionId, deviceId, null, deps, history, app, text);
          return;
        }

        if (type === 'interrupt') {
          // Abort current turn
          currentAbortController?.abort();
          currentAbortController = null;
          send(socket, { type: 'turn.end', turnId: currentTurnId, reason: 'interrupted' });
          return;
        }

        if (type === 'tool.approval') {
          const callId = msg['callId'] as string;
          const decision = msg['decision'] as 'approve' | 'deny';
          deps.approvalPolicy.submitDecision(callId, decision);
          return;
        }
      });

      socket.on('close', async () => {
        currentAbortController?.abort();
        await deps.db
          .update(schema.sessions)
          .set({ endedAt: Date.now() })
          .where(eq(schema.sessions.id, sessionId));
        app.log.info({ sessionId }, 'WS session ended');
      });

      socket.on('error', (err: Error) => {
        app.log.error({ sessionId, err }, 'WS error');
      });
    },
  );
}

async function processTurn(
  socket: WebSocket,
  turnId: string,
  sessionId: string,
  deviceId: string,
  audioBuffer: Buffer | null,
  deps: WsDeps,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  app: FastifyInstance,
  textOverride?: string,
) {
  const timing: Record<string, number> = { start: Date.now() };
  const abortController = new AbortController();
  let userText = textOverride ?? '';

  try {
    // STT if audio provided
    if (audioBuffer && audioBuffer.byteLength > 0) {
      const sttStart = Date.now();
      try {
        const { text } = await deps.stt.transcribe(new Uint8Array(audioBuffer), {});
        userText = text;
        timing['stt_ms'] = Date.now() - sttStart;
        send(socket, { type: 'turn.transcript', turnId, text, final: true });
      } catch (err) {
        app.log.error(err, 'STT failed');
        send(socket, { type: 'error', code: 'STT_FAILED', message: 'Speech recognition failed', turnId });
        send(socket, { type: 'turn.end', turnId, reason: 'error' });
        return;
      }
    } else {
      send(socket, { type: 'turn.transcript', turnId, text: userText, final: true });
    }

    if (!userText.trim()) {
      send(socket, { type: 'turn.end', turnId, reason: 'complete' });
      return;
    }

    // Save user message
    await deps.db.insert(schema.messages).values({
      id: randomUUID(),
      sessionId,
      turnId,
      role: 'user',
      content: userText,
      createdAt: Date.now(),
    });

    // Get memory context
    const memories = await deps.memoryService.search(userText, 5);
    const memoryContext = memories.length > 0
      ? memories.map((m) => `- ${m.text}`).join('\n')
      : undefined;

    let firstToken = false;
    let assistantText = '';
    let ttsSeq = 0;

    // ── Sequential TTS queue (concurrency = 1) ──────────────────────────────
    // Local VoiceStudio has 1 GPU worker. Firing multiple sentences concurrently
    // saturates the GPU worker pool (HTTP 429). We process sentences strictly
    // one-at-a-time in background, sending each audio clip to the client as soon
    // as it is ready for low-latency streaming without GPU overload.
    const ttsQueue: Array<{ seq: number; sentence: string }> = [];
    let isSynthesizing = false;

    async function processNextTts() {
      if (isSynthesizing || ttsQueue.length === 0 || abortController.signal.aborted) return;
      isSynthesizing = true;
      const item = ttsQueue.shift();
      if (!item) {
        isSynthesizing = false;
        return;
      }

      const ttsStart = Date.now();
      try {
        const { audio, mimeType } = await deps.tts.synthesize(item.sentence, {
          voiceId: deps.persona.voiceId,
          signal: abortController.signal,
        });

        if (!timing['tts_ms']) timing['tts_ms'] = Date.now() - ttsStart;

        send(socket, {
          type: 'assistant.speech',
          turnId,
          seq: item.seq,
          text: item.sentence,
          mimeType,
          bytes: audio.byteLength,
        });

        if (socket.readyState === 1) {
          socket.send(audio);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          const errMsg = err instanceof Error ? err.message : String(err);
          app.log.warn(err, `TTS failed for sentence: "${item.sentence.slice(0, 40)}"`);
          send(socket, {
            type: 'tts.error',
            turnId,
            message: errMsg,
          });
        }
      } finally {
        isSynthesizing = false;
        if (ttsQueue.length > 0 && !abortController.signal.aborted) {
          // Process next sentence
          processNextTts();
        }
      }
    }

    function enqueueTts(sentence: string) {
      const seq = ttsSeq++;
      ttsQueue.push({ seq, sentence });
      processNextTts();
    }

    // Run agent turn
    const result = await runTurn(
      userText,
      {
        llm: deps.llm,
        tools: deps.toolRegistry,
        policy: deps.approvalPolicy,
        persona: deps.persona,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        memoryContext,
      },
      {
        onTextDelta: (text) => {
          if (!firstToken) {
            timing['llm_first_token_ms'] = Date.now() - (timing['start'] ?? 0);
            firstToken = true;
          }
          send(socket, { type: 'assistant.text.delta', turnId, text });
          assistantText += text;
        },
        onSentence: (sentence) => {
          if (deps.env.TTS_PROVIDER === 'voicestudio') {
            // Fire VoiceStudio TTS in background
            enqueueTts(sentence);
          } else {
            // In HeyGen mode, send sentence text directly to client for avatar live speech
            send(socket, {
              type: 'assistant.speech_text',
              turnId,
              seq: ttsSeq++,
              text: sentence,
            });
          }
        },
        onToolCall: (callId, name, args) => {
          send(socket, { type: 'tool.call', turnId, callId, name, args });
        },
        onToolApprovalRequest: (callId, name, tier, summary, args) => {
          send(socket, {
            type: 'tool.approval.request',
            callId,
            name,
            tier,
            summary,
            args,
            timeoutMs: 60_000,
          });
        },
        onToolResult: (callId, ok, error) => {
          send(socket, { type: 'tool.result', callId, ok, error });
        },
        onError: (code, message) => {
          send(socket, { type: 'error', code, message, turnId });
        },
      },
      abortController.signal,
    );

    assistantText = result.assistantText;

    // Wait for remaining in-flight TTS to finish (if VoiceStudio is active)
    if (deps.env.TTS_PROVIDER === 'voicestudio') {
      while (isSynthesizing || ttsQueue.length > 0) {
        if (abortController.signal.aborted) break;
        await new Promise((r) => setTimeout(r, 40));
      }
    }

    // Save assistant message
    if (assistantText) {
      await deps.db.insert(schema.messages).values({
        id: randomUUID(),
        sessionId,
        turnId,
        role: 'assistant',
        content: assistantText,
        createdAt: Date.now(),
      });

      // Update history (keep last 20 messages)
      history.push({ role: 'user', content: userText });
      history.push({ role: 'assistant', content: assistantText });
      if (history.length > 20) history.splice(0, history.length - 20);
    }

    timing['total_ms'] = Date.now() - (timing['start'] ?? 0);
    app.log.info({ turnId, timing }, 'Turn complete');

    send(socket, {
      type: 'turn.end',
      turnId,
      reason: 'complete',
      timing: {
        stt_ms: timing['stt_ms'],
        llm_first_token_ms: timing['llm_first_token_ms'],
        tts_ms: timing['tts_ms'],
        total_ms: timing['total_ms'],
      },
    });
  } catch (err) {
    app.log.error(err, 'Turn processing failed');
    send(socket, { type: 'error', code: 'LLM_FAILED', message: 'Processing failed', turnId });
    send(socket, { type: 'turn.end', turnId, reason: 'error' });
  }
}

