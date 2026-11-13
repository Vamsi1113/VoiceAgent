# Companion — Personal AI Voice Agent with 3D Avatar

> **Context for AI Agents & Developers:**  
> This file is a comprehensive architecture map and operational guide. It details what has been built, the exact directory and file structure, design principles, running instructions, and the status of upcoming phases per `AGENTS.md` and `docs/PRD.md`.

---

## 1. System Overview

**Companion** is a single-user personal assistant platform designed for low-latency conversational voice interactions with a realistic 3D talking avatar.

### Key Pillars
- **Local Speech Processing:** Text-to-Speech (TTS) and Speech-to-Text (STT) run locally on the user's GPU/CPU via **VoiceStudio** (`http://localhost:3900`, OpenAI-compatible `/v1/audio/speech`, `/v1/audio/transcriptions`, `/v1/audio/voices`).
- **Unified Gateway (Modular Monolith):** A single Fastify gateway manages auth, WebSocket sessions, LLM streaming, database operations, and tool executions. Clients never contact LLMs or VoiceStudio directly.
- **Cascaded Voice Pipeline:** Mic -> Silero VAD (client) -> STT -> LLM stream -> sentence splitter -> TTS per sentence -> client playback + HeadAudio lip-sync.
- **Risk-Tiered Tools:** Actions are classified into **T0** (read-only auto-run), **T1** (reversible writes), and **T2** (sensitive/destructive — strictly requires explicit on-screen user approval).
- **Long-Term Memory:** Stored in SQLite via Drizzle ORM with full-text search (FTS), injected as untrusted data into LLM prompts.
- **MCP Integration:** Capabilities are exposed as an MCP server at `/mcp` on the gateway for Claude and other MCP clients.

---

## 2. Monorepo Map & Code Locations

```
companion/
├── AGENTS.md                                   # Standing rules for coding agents
├── README.md                                   # This agent & developer guide
├── package.json                                # Root workspace & scripts
├── pnpm-workspace.yaml                         # Monorepo packages definition
├── tsconfig.base.json                          # Shared TypeScript configuration
├── vitest.config.ts                            # Monorepo test configuration
├── .env.example / .env                         # Server environment variables
│
├── config/                                     # Assistant configuration
│   ├── assistant.json                          # Name, default voice ID, language, avatar URL
│   └── persona.md                              # System prompt, style guidelines & personality
│
├── docs/                                       # Specifications & decisions
│   ├── PRD.md                                  # Complete product requirements document
│   ├── runbook.md                              # Operational runbook
│   ├── avatar-licence.md                       # Licences for 3D models and worklets
│   └── decisions/                              # Architecture Decision Records (ADRs)
│       ├── 001-spike-results.md                # Phase 0 spike results
│       └── 002-libsql-sqlite-driver.md         # ADR on using @libsql/client
│
├── packages/                                   # Shared core libraries
│   │
│   ├── protocol/                               # Zod schemas & generated TS types
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts                        # Barrel export
│   │       ├── ws-client.ts                    # Client->Server WS messages (input.text, audio, approval, interrupt)
│   │       ├── ws-server.ts                    # Server->Client WS messages (turn.transcript, speech, tool.call, errors)
│   │       ├── rest.ts                         # REST payload schemas (pairing, memories, tts)
│   │       ├── errors.ts                       # Typed error codes (STT_FAILED, TTS_FAILED, etc.)
│   │       └── protocol.test.ts                # Unit tests for schemas
│   │
│   ├── memory/                                 # Database & memory service
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts                        # Exports createDb, MemoryService, schema, and Drizzle operators
│   │       ├── schema.ts                       # Drizzle SQLite schema (devices, sessions, messages, memories, etc.)
│   │       ├── db.ts                           # Database factory with automatic table initialization via @libsql/client
│   │       └── memory-service.ts               # Long-term fact storage, updates, deletion & search
│   │
│   ├── core/                                   # Agent loop & orchestration
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts                        # Barrel export
│   │       ├── agent-loop.ts                   # runTurn() execution loop with tool approval & sentence streaming
│   │       ├── tool-registry.ts                # ToolRegistry, RiskTier (T0/T1/T2) & DefaultApprovalPolicy
│   │       ├── sentence-splitter.ts            # Punctuation/abbreviation-aware text chunker for TTS
│   │       ├── sentence-splitter.test.ts       # Sentence splitter unit tests (decimals, Dr., p.m., Hindi danda)
│   │       ├── tool-registry.test.ts           # Tool registry & approval policy tests
│   │       └── providers/
│   │           └── interfaces.ts               # Stable contracts: LlmProvider, SttProvider, TtsProvider
│   │
│   └── providers/                              # External service integrations
│       ├── package.json
│       └── src/
│           ├── index.ts                        # Barrel export
│           ├── llm-anthropic.ts                # Anthropic Claude streaming provider with tool use
│           └── voicestudio.ts                  # VoiceStudio HTTP client (POST /v1/audio/transcriptions & /speech)
│
├── apps/                                       # Executable applications
│   │
│   ├── gateway/                                # Fastify backend server
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts                        # Gateway server entry point, CORS, WS registration
│   │       ├── env.ts                          # Validated environment configuration via Zod
│   │       ├── auth.ts                         # JWT token generation, verification & pairing codes
│   │       ├── persona.ts                      # Loads config/persona.md & config/assistant.json
│   │       ├── cli/
│   │       │   └── pair-first.ts               # CLI script to bootstrap the first device (npm run pair:first)
│   │       ├── tools/
│   │       │   └── index.ts                    # Internal tool implementations (get_time, memory_search, memory_add, notes_add, reminder_create)
│   │       ├── ws/
│   │       │   └── session.ts                  # Live session WebSocket handler (audio handling, STT, LLM turn, TTS streaming)
│   │       └── routes/
│   │           ├── healthz.ts                  # Health endpoint (probes VoiceStudio & gateway)
│   │           ├── pairing.ts                  # Pairing REST endpoints (/v1/pairing/start, approve, complete, refresh)
│   │           ├── memories.ts                 # Memory CRUD REST routes (/v1/memories)
│   │           ├── voices.ts                   # Proxy to VoiceStudio voices (/v1/voices)
│   │           ├── tts.ts                      # Authenticated TTS endpoint (/v1/tts)
│   │           ├── assistant.ts                # Non-secret assistant info (/v1/assistant)
│   │           └── audit.ts                    # Tool call audit log endpoint (/v1/audit)
│   │
│   └── web/                                    # React + Vite frontend UI
│       ├── package.json
│       ├── vite.config.ts                      # Vite configuration with preserveSymlinks for Windows
│       ├── index.html                          # Entry HTML
│       └── src/
│           ├── main.tsx                        # React DOM root
│           ├── index.css                       # Global styles & theme variables
│           ├── App.tsx                         # Authentication router (Login vs Chat)
│           ├── vite-env.d.ts                   # CSS module & Vite client declarations
│           ├── pages/
│           │   ├── Login.tsx / .module.css     # Device pairing / access token entry screen
│           │   └── Chat.tsx / .module.css      # Main session view (WebSocket lifecycle, streaming messages, audio queue)
│           └── components/
│               ├── MessageList.tsx / .module.css # Chat transcript with thinking indicators
│               ├── TextInput.tsx / .module.css   # Text message input with Enter-to-send
│               └── ToolApprovalCard.tsx / .module.css # Modal dialog for approving T1/T2 tool calls
│
└── scripts/
    └── build.js                                # Cross-platform monorepo build runner
```

---

## 3. How the Pieces Work Together

### 3.1 Authentication & Pairing Flow
1. First time setup: Admin runs `npm run pair:first` on the server/PC.
2. A new device record is stored in SQLite, and an **Access Token** (valid 15 minutes) and **Refresh Token** (valid 30 days) are generated.
3. The user opens the Web UI (`http://localhost:5173`) and pastes the Access Token.
4. The Web UI validates the token via `GET /v1/assistant` and saves it to `localStorage`.
5. Subsequent live sessions connect to `ws://localhost:3001/v1/session?token=<accessToken>`.

### 3.2 The Live Turn Loop
```
User (Web Client)
   │
   ├─► [input.text or input.audio.end] (via WebSocket)
   ▼
Gateway Session Handler (`apps/gateway/src/ws/session.ts`)
   │
   ├── (If Audio) ──► VoiceStudio STT (`POST /v1/audio/transcriptions`)
   ├── Query Long-Term Memory ──► FTS lookup via `MemoryService`
   ├── Ingest context into `runTurn()` (`packages/core/src/agent-loop.ts`)
   ▼
Core Agent Loop
   │
   ├── Streams Anthropic LLM (`packages/providers/src/llm-anthropic.ts`)
   ├── Forwards text deltas to client: `assistant.text.delta`
   ├── Feeds text into `SentenceSplitter`
   │      └── As sentences finish: calls VoiceStudio TTS (`POST /v1/audio/speech`)
   │      └── Sends audio bytes to client: `assistant.speech` (header + binary frame)
   │
   └── If Tool Call requested:
          ├── Check risk tier in `ToolRegistry`
          ├── If T0 (e.g. `get_time`, `memory_search`): auto-execute
          ├── If T1/T2: send `tool.approval.request` to client, await `tool.approval` decision
          └── Append sanitized result to conversation history
   ▼
Client receives `turn.end` and audio streams playback in real time.
```

---

## 4. Key Architectural Decisions (ADRs)

1. **SQLite Engine with `@libsql/client` (ADR 002):**
   * *Problem:* `better-sqlite3` native C++ prebuilds are not available for Windows Node 24 (`v24.11.1`), and compilation fails without Visual Studio C++ build tools.
   * *Solution:* Switched to `@libsql/client` with `drizzle-orm/libsql`. Fully compatible, zero native compilation required, identical SQLite file format and query semantics.
2. **Vite `preserveSymlinks: true`:**
   * Prevents Windows file system `realpath` EPERM errors when resolving symlinked workspace packages in pnpm.
3. **No Direct Client Connections:**
   * Clients **never** make direct requests to VoiceStudio (`localhost:3900`) or the Anthropic API. Everything is routed through the Fastify gateway to ensure root credentials stay secure on the server.

---

## 5. Prerequisites & Environment Setup

### Prerequisites
- **Node.js**: v20+ (tested on v24.11.1)
- **Package Manager**: npm or pnpm
- **VoiceStudio**: Installed and running at `http://localhost:3900`
- **Anthropic API Key** (or an OpenAI-compatible endpoint like local Ollama)

### Environment Configuration (`.env`)
The file `companion/.env` should contain:
```env
# LLM configuration
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key_here
LLM_MODEL=claude-3-5-haiku-20241022

# VoiceStudio local speech engine
VOICESTUDIO_BASE_URL=http://localhost:3900
OMNIVOICE_API_KEY=
VOICE_ID=alloy

# Gateway
PORT=3001
HOST=127.0.0.1
JWT_SECRET=your_generated_64_char_hex_secret

# Database & Logging
DATABASE_PATH=./data/companion.db
LOG_LEVEL=info
MCP_AUTH_ENABLED=0
```

---

## 6. How to Run and Execute

### 1. Build the Monorepo
```powershell
cd "c:\Users\MrVamsiKasireddy\Desktop\My demos\VoiceStudio\companion"
npm run build
```
*This compiles all TypeScript packages (`protocol`, `memory`, `core`, `providers`, `gateway`) and bundles the React app with Vite.*

### 2. Run Automated Tests
```powershell
npm test
```
*Executes Vitest across all packages (validates schemas, sentence splitter edge cases, and tool risk tier approval rules).*

### 3. Generate First Device Pairing Token
```powershell
npm run pair:first
```
*Outputs an `Access Token` to use when logging in to the web interface.*

### 4. Start the Application
To run the Fastify gateway and Vite dev server simultaneously:
```powershell
npm run dev
```

Or run them in separate terminals:
* **Gateway:** `npm --prefix apps/gateway run dev` (runs on `http://127.0.0.1:3001`)
* **Web Client:** `npm --prefix apps/web run dev` (runs on `http://localhost:5173`)

### 5. Access the Web App
1. Open `http://localhost:5173` in your browser.
2. Paste the Access Token generated in step 3.
3. Start interacting with Nova.

---

## 7. Current Project Phase & Next Steps

Referring to Section 17 of `docs/PRD.md`:

| Phase | Description | Status |
|---|---|---|
| **Phase 0** | Monorepo scaffold, spikes setup, ADRs, build/test infrastructure | **Completed** |
| **Phase 1** | Gateway, REST + WS session protocol, LLM streaming, SQLite memory, Web chat UI | **Completed** |
| **Phase 2** | Voice loop in `voice-client`: mic capture, Silero VAD, binary audio over WS, barge-in | **Next to build** |
| **Phase 3** | 3D Avatar in `packages/avatar`: TalkingHead + HeadAudio worklet, moods, gestures | Upcoming |
| **Phase 4** | Advanced agent capabilities: Google Calendar OAuth read, automated memory extraction | Upcoming |
| **Phase 5** | MCP Server mounted at `/mcp` using Streamable HTTP for Claude connector integration | Upcoming |
| **Phase 6** | Windows Electron transparent floating app & Android Capacitor wrapper | Upcoming |
| **Phase 7** | Cloned voices, wake word, embeddable `<companion-avatar>` web widget | Future |

