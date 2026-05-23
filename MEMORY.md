# MEMORY.md — Alfredo Project Context

## Project Overview
Alfredo is a WhatsApp-based DevOps AI Companion for Christian Rizaldi (DevOps Engineer) managing 40+ servers and 600+ GitLab repos. Bot answers PM questions during 03:00–12:00 WIB using real-time DB data with zero-hallucination policy. Ambiguity detection asks for clarification when same repo name exists across different GitLab groups.

## Tech Stack
- **Framework**: Next.js 14 App Router (`src/app/`)
- **Database/Auth**: Supabase (PostgreSQL, Auth, Realtime, RLS)
- **Hosting**: Vercel (serverless) — `https://alfredo-pi.vercel.app`
- **AI**: Multi-provider — DeepSeek (default), OpenAI, Google Gemini, Ollama Cloud (switchable via dashboard or `AI_PROVIDER` env)
- **Messaging**: Multi-provider — Fonnte (active), Meta, Evolution API (switchable via `WA_PROVIDER` env)
- **Styling**: Tailwind CSS v3 + shadcn/ui (Outfit font, zinc/neutral palette, dark mode via `next-themes`)

## Bot Personality & Language
- Identity: **Alfredo 🤖**, DevOps AI Companion milik Christian Rizaldi
- Style: santai profesional, sapaan "Halo", jawab ringkas to-the-point
- Perkenalkan diri di pesan pertama
- Fallback: "Halo! 🤖 Data untuk pertanyaan itu belum tersedia di sistem saya. Ijal akan follow up secepatnya setelah online ya!"
- Timestamps: semua dikonversi ke WIB (Asia/Jakarta) sebelum masuk ke LLM
- Ambiguity: jika project duplikat (sama repo_name beda group), WAJIB tanya klarifikasi

## Key Features

### Server Monitoring (Daemon)
- Bash daemon script generated from `/api/daemon` with embedded secrets
- 3-second interval (vs old cron 60s)
- Metrics: CPU delta from `/proc/stat` (state file), Memory from `/proc/meminfo`, Disk from `df -P`, Uptime from `/proc/uptime`
- Docker container detection with `docker inspect`, error logs from `docker logs --tail 100`
- Systemd unit generated via `/api/daemon?type=service` with PATH environment
- On first ping: sends container list immediately (no 60s wait)
- Fallback: old cron script at `/api/scripts/alfredo-ping.sh` still works

### Real-Time Dashboard
- 2-second polling via Supabase browser client
- Supabase Realtime subscription for DB changes (server_status + project_status)
- Server cards show: CPU/Memory/Disk load, last ping, uptime hours
- Docker containers shown in server detail dialog
- Stale threshold: 10s → shows "Offline" badge, dims metrics
- Terminal icon on each server card → opens setup dialog (daemon/cron toggle)

### Bot Mode System
- `src/lib/bot-mode.ts`: `getBotMode()` reads `bot_mode` from `app_settings` (cached 5 min), `shouldBotReply()` returns `{ reply, mode, humanReply? }`
- Three modes: `normal` (active hours, default 03:00–12:00 WIB), `extended` (24/7 AI), `human` (bot offline, sends human reply template)
- Human mode reply: "Halo! 🤖 Ijal sedang online sekarang. Silakan hubungi langsung ya — Alfredo standby."
- `bot_mode` stored in `app_settings` JSON under `ai_config.bot_mode` key
- Active hours (`active_start`, `active_end`) stored in `app_settings` JSON under `ai_config`
- Active hours fallback: DB → `BOT_ACTIVE_START`/`BOT_ACTIVE_END` env → default `03:00`/`12:00`

### AI / LLM
- `AI_PROVIDER` env or dashboard settings selects LLM backend: `deepseek`, `openai`, `gemini`, `ollama`
- All 4 providers use OpenAI-compatible `/chat/completions` format with raw `fetch` — no SDK
- Ollama Cloud at `https://ollama.com/api/chat` with `Authorization: Bearer` header
- System prompt uses `=== DATA DATABASE ===` / `=== AKHIR DATA ===` markers with few-shot example
- Dashboard stores encrypted API keys in `app_settings` (AES-256-GCM via `ENCRYPTION_KEY`)
- LLM config cached 5 min in memory; cache invalidated on dashboard save
- `askAlfredo()` returns `{ reply, debug }`; webhooks destructure `const { reply } = await askAlfredo(...)`

### Search & Response
- `src/lib/search.ts`: keyword extraction with stop-word filtering
- `src/lib/llm.ts`: `detectAmbiguousProjects()` scans context for same repo_name + different group → prepends warning
- Dedup key includes `project_group` — duplicate repo names across groups both appear
- Empty context → fallback message without calling LLM (zero hallucination)
- `error_detail` from GitLab job logs included in search context when present
- Phone number normalization via `src/lib/phone.ts` (08xx→628xx, +62xx→62xx, 8xx→628xx)

### GitLab Integration
- Webhook extracts project group from `path_with_namespace` field
- Saves `gitlab_project_id` for API calls
- On pipeline `failed`: auto-fetches last ~2000 chars of failed job log via PAT → stores in `error_detail`
- On pipeline `success`/`running`: clears `error_detail`
- GitLab PAT stored encrypted in `app_settings`, scope: `api`
- CLI script `scripts/setup-gitlab-webhooks.mjs` for bulk project-level webhook creation

### Messaging Provider
- `WA_PROVIDER` env selects provider: `meta`, `fonnte`, or `evolution`
- Fonnte active — webhook accepts both JSON and formData payloads
- Group chat: Fonnte uses `member` field, Evolution uses `remoteJid.endsWith('@g.us')`
- Meta group support not yet implemented

### Encryption
- `src/lib/encryption.ts` — AES-256-GCM encrypt/decrypt/maskKey
- `ENCRYPTION_KEY` env var (32-byte hex, generate with `openssl rand -hex 32`)
- Dashboard shows masked keys; user must re-enter to change
- Decrypted only server-side during LLM calls
- **If ENCRYPTION_KEY changes**: all stored API keys must be re-saved from dashboard

## Key Decisions & Gotchas

### Vercel Deployment
- All API routes need `export const dynamic = 'force-dynamic'` — without it, Vercel prerenders routes as static → returns 405
- All API routes need `Cache-Control: no-store` header — prevents edge caching
- `SUPABASE_SERVICE_ROLE_KEY` must be the actual service_role key (not anon key) — wrong key causes RLS violations on INSERT/UPDATE
- `app_settings` table has RLS disabled (admin-only table accessed via service-role key)
- Supabase Broadcast doesn't work on Vercel serverless (WebSocket per-invocation unreliable) — reverted to 2s polling

### Supabase Client SSR
- `createClient()` (browser) must NOT be called at component top level in Client Components
- Move `createClient()` inside `useEffect` or event handlers

### CSS/Font (Fixed)
- shadcn v4 `@import "shadcn/tailwind.css"` incompatible with Next.js 14 / Tailwind v3
- Use standard `@tailwind base/components/utilities` + CSS variables
- Geist font from `next/font/google` only works in Next.js 15+; use local Outfit font

### Dark/Light Theme
- `next-themes` package with `class` attribute on `<html>`
- CSS variables for `.dark` defined in `globals.css`
- Theme toggle (Sun/Moon icons) in dashboard header
- `ThemeProvider` wraps app in `src/components/providers.tsx`

### Route Structure
- All dashboard pages under `src/app/(dashboard)/dashboard/`:
  - `/dashboard` — main monitoring view
  - `/dashboard/logs` — chat logs
  - `/dashboard/override` — server management + note editor + crontab generator
  - `/dashboard/settings` — AI provider, API keys, bot mode, active hours, GitLab PAT
  - `/dashboard/whitelist` — PM phone number whitelist management
- Middleware protects all `/dashboard/:path*` routes

### Dashboard Realtime
- RealtimeServerStatus.tsx: 2s polling + Supabase postgres_changes subscription
- RealtimeProjectStatus.tsx: pipeline status cards with stale detection
- Stale threshold: 10s → Offline badge + dimmed metrics

## Database Schema (supabase/schema.sql + migrations)

### Tables
- `project_status` — GitLab pipeline statuses (UPSERT by `repo_name`), columns: `error_detail`, `gitlab_project_id`
- `server_status` — Server metrics (UPSERT by `server_name`), columns: `ping_secret` (unique), `cpu_usage`, `memory_usage`, `disk_usage`, `uptime_hours`
- `container_status` — Docker containers (UPSERT by `server_name,container_name`)
- `chat_logs` — PM ↔ bot conversation log, columns: `is_group`, `group_id`
- `whitelisted_pms` — Phone numbers allowed to chat
- `app_settings` — JSONB key-value for dashboard config (`ai_config`), RLS disabled

### RLS
- All tables except `app_settings` have RLS enabled
- Policy: `auth.role() = 'authenticated'` → full access
- Webhooks use service-role key (bypasses RLS)
- Dashboard uses anon key + authenticated user session

## API Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/webhook/gitlab` | POST | GitLab pipeline events + auto error fetch |
| `/api/server-ping` | GET/POST | Server metrics (per-server ping_secret auth) |
| `/api/daemon` | GET | Generate bash daemon script |
| `/api/daemon?type=service` | GET | Generate systemd unit |
| `/api/servers` | GET/POST/DELETE | Server management CRUD |
| `/api/webhook/fonnte` | POST | Fonnte messages |
| `/api/webhook/whatsapp` | GET/POST | Meta webhook verify + messages |
| `/api/webhook/evolution` | POST | Evolution API messages |
| `/api/settings` | GET/PUT | AI config + GitLab PAT + bot_mode |
| `/api/whitelist` | GET/POST/DELETE | PM whitelist CRUD |
| `/api/auth/signout` | POST | Sign out action |

## Critical Config
- Supabase project: `https://hltaugtnqzqfhgcfvnet.supabase.co`
- Vercel deployment: `https://alfredo-pi.vercel.app`
- `ENCRYPTION_KEY` must be set in Vercel
- `NEXT_PUBLIC_APP_URL` defaults to `http://localhost:3000`

## What's Done
- [x] Next.js 14 App Router + shadcn/ui + Tailwind v3 + dark mode + Outfit font
- [x] Supabase schema + RLS + trigram indexes + migrations 001-004
- [x] Supabase clients (browser, server, admin/service-role)
- [x] Auth middleware + login page
- [x] Real-time dashboard (2s polling + Supabase Realtime)
- [x] Server monitoring daemon (3s interval bash script + systemd unit)
- [x] Docker container detection with error log fetching
- [x] GitLab webhook with pipeline status + auto error fetch
- [x] Server ping endpoint with per-server ping_secret auth
- [x] Server management API + dashboard Add Server with daemon/cron toggle
- [x] Fonnte provider + webhook (active, tested)
- [x] Evolution API provider + webhook
- [x] Messaging provider abstraction (factory pattern)
- [x] Multi-provider LLM (DeepSeek, OpenAI, Gemini, Ollama Cloud)
- [x] Smart search with project_group dedup + ambiguity detection
- [x] Phone number normalization for Indonesian formats
- [x] Bot mode system (Normal/Extended/Human)
- [x] Encrypted API key storage (AES-256-GCM)
- [x] Whitelist management dashboard
- [x] WIB timestamp conversion in LLM context
- [x] Bot personality: Alfredo 🤖, santai profesional
- [x] CLI script for bulk GitLab webhook creation
- [x] Stale threshold (10s) + Offline badge on dashboard
- [x] Copy button on container error logs + pipeline error logs
- [x] Vercel deployment fixes (force-dynamic, Cache-Control no-store)
- [x] Build passes clean, lint passes

## What's Not Done Yet
- [ ] pgvector embedding search (env vars exist, schema not)
- [ ] Pagination on logs/projects for 600+ records
- [ ] Tests (no test framework set up)
- [ ] Meta WhatsApp group support (needs Group API setup)

## Current Issues (Debugging)
- Dashboard showing 0% CPU/memory/disk → re-download daemon script from dashboard, restart systemd service
- Daemon sending 0 values → check `journalctl -u alfredo-daemon -f` for debug output
- API returns stored values correctly → issue is daemon script version (re-download to get latest)