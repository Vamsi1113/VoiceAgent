# Companion — Runbook

## Overview
- **Gateway**: Fastify server on port 3001 (REST + WebSocket + MCP stub)
- **Web UI**: React + Vite dev server on port 5173
- **VoiceStudio**: External local app on port 3900 (must be running separately)
- **Database**: SQLite at `./data/companion.db`

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Runtime |
| pnpm | 9+ | Package manager |
| VoiceStudio | latest | Local TTS + STT |
| Anthropic API key | — | LLM (or use local Ollama) |

---

## First-time setup

```powershell
# 1. Clone / navigate to companion directory
cd "c:\Users\MrVamsiKasireddy\Desktop\My demos\VoiceStudio\companion"

# 2. Install dependencies
pnpm install

# 3. Configure environment
copy .env.example .env
# Edit .env — set JWT_SECRET (run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
# Set ANTHROPIC_API_KEY
# Set VOICE_ID to a VoiceStudio voice profile ID (get from GET /v1/audio/voices after VoiceStudio starts)

# 4. Build all packages
pnpm build

# 5. Create the data directory
mkdir apps\gateway\data

# 6. Pair the first device (get an access token)
pnpm run pair:first
# → Copy the printed Access Token
```

---

## Running in development

```powershell
# Terminal 1: Start VoiceStudio (do this first)
# Launch VoiceStudio from its installer / desktop shortcut

# Terminal 2: Start gateway + web dev server together
pnpm dev

# Or separately:
# Terminal 2: gateway only
pnpm -F gateway dev

# Terminal 3: web only
pnpm -F web dev
```

- Web UI: http://localhost:5173
- Gateway API: http://localhost:3001
- Health check: http://localhost:3001/healthz

---

## Ports and env vars

| Var | Default | Description |
|-----|---------|-------------|
| PORT | 3001 | Gateway listen port |
| HOST | 127.0.0.1 | Gateway bind address |
| DATABASE_PATH | ./data/companion.db | SQLite path |
| JWT_SECRET | — | **Required.** Min 32 chars |
| ANTHROPIC_API_KEY | — | Anthropic Claude API key |
| VOICESTUDIO_BASE_URL | http://localhost:3900 | VoiceStudio base URL |
| OMNIVOICE_API_KEY | — | Only needed if VoiceStudio is remote |
| VOICE_ID | alloy | TTS voice profile ID |
| LOG_LEVEL | info | Pino log level |

---

## Common commands

```powershell
pnpm install          # Install all dependencies
pnpm dev              # Start gateway + web in dev mode
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all TypeScript/TSX files
pnpm typecheck        # Type-check all packages
pnpm run pair:first   # Generate first device access token
```

---

## Production

```powershell
pnpm build
cd apps/gateway
node --env-file=../../.env dist/index.js
```

The built web app is at `apps/web/dist/`. Serve it with a static file server or configure the gateway to serve it.

---

## Backups

```powershell
# SQLite — copy while gateway is stopped, or use online backup
copy apps\gateway\data\companion.db backup\companion-$(Get-Date -Format yyyyMMdd).db
```

---

## Updating

```powershell
git pull
pnpm install
pnpm build
# Restart gateway
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| VoiceStudio unreachable | Make sure VoiceStudio is running and port 3900 is available |
| Token expired | Re-run `pnpm run pair:first` or use refresh token |
| WebSocket disconnect | Check gateway is running; browser auto-reconnects in 3 s |
| TTS silent | Check VOICE_ID is a valid voice profile ID from `/v1/voices` |

