# AGENTS.md

## Commands
- Package manager: `npm` (`package-lock.json` is present)
- Dev server: `npm run dev`; production build: `npm run build`; serve build: `npm run start`
- Lint: `npm run lint`

## Setup & Env
- Copy `.env.example` to `.env.local`
- Run `supabase/schema.sql` in Supabase SQL Editor (creates tables, RLS, trigram indexes)
- Run migrations in order:
  - `supabase/migrations/001_add_columns.sql` — adds `ping_secret`, `error_detail`, `gitlab_project_id`
  - `supabase/migrations/002_add_group_support.sql` — adds `is_group`, `group_id` to chat_logs
  - `supabase/migrations/003_add_bot_mode.sql` — adds bot_mode to app_settings
  - `supabase/migrations/004_add_metrics.sql` — adds `cpu_usage`, `memory_usage`, `disk_usage`, `uptime_hours` to server_status + creates container_status table
- Disable RLS on `app_settings`: `ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;`
- `SUPABASE_SERVICE_ROLE_KEY` must be the actual service_role key (not anon key). Wrong key causes RLS violations on INSERT/UPDATE.
- `ENCRYPTION_KEY` (32-byte hex) required for AI settings encryption. Generate with `openssl rand -hex 32`. **If regenerated**, all stored API keys must be re-saved from dashboard.
- `NEXT_PUBLIC_APP_URL` defaults to `http://localhost:3000` when unset; signout redirects depend on that value.

## Architecture
- App Router under `src/app`; alias `@/*` maps to `src/*`
- Dashboard pages: `src/app/(dashboard)/dashboard/` — `/dashboard`, `/dashboard/logs`, `/dashboard/override`, `/dashboard/settings`, `/dashboard/whitelist`
- Middleware protects all `/dashboard/:path*` routes
- Supabase clients: browser `src/lib/supabase/client.ts`, server `src/lib/supabase/server.ts`, service-role `src/lib/supabase/admin.ts`
- All API routes must have `export const dynamic = 'force-dynamic'` + `Cache-Control: no-store` — without these, Vercel prerenders routes as static → 405

## Server Monitoring Architecture

### Daemon Script (`/api/daemon`)
- Generates bash daemon script with embedded `ping_secret` and `ping_url`
- 3-second interval, no Node.js dependency
- Functions: `read_cpu()` (delta from `/proc/stat` + state file), `read_mem()` (MemTotal/MemAvailable), `read_disk()` (`df -P`), `read_uptime()` (`/proc/uptime`), `read_containers()` (docker inspect)
- `build_payload()` uses `jq` with `tonumber` try/catch for safe number conversion
- First ping sends container list immediately (no 60s wait)

### Systemd Unit (`/api/daemon?type=service`)
- Generated with `Environment=PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`
- Logs to journal (`StandardOutput=journal`, `StandardError=journal`)
- Auto-restart on failure (`Restart=always`, `RestartSec=3`)

### Metrics Endpoint (`/api/server-ping`)
- Accepts POST with JSON body: `{ cpu, memory, disk, uptime_hours, containers }`
- Auth via `?secret=<ping_secret>` — matches against `server_status.ping_secret`
- Returns `{ ok: true, server: "name", stored: { cpu, memory, disk, uptime_hours } }`
- Updates `server_status` table: `cpu_usage`, `memory_usage`, `disk_usage`, `uptime_hours`
- Upserts containers to `container_status` table, deletes stale containers

### Old Cron Script (`/api/scripts/alfredo-ping.sh`)
- Still available as fallback (1-min interval)
- No container monitoring (too slow with `docker logs`)

## Dashboard Realtime (`src/components/realtime/`)

### RealtimeServerStatus.tsx
- 2-second polling via `setInterval(fetchServers, 2000)`
- Supabase Realtime subscription on `server_status` table
- Server cards show: CPU/Memory/Disk load, last ping, uptime
- Stale threshold: 10s → shows "Offline" badge, dims metrics
- Terminal icon on each card → opens ServerSetupDialog (daemon/cron toggle)
- Container detail in ServerDetailDialog with copy error log button

### RealtimeProjectStatus.tsx
- Pipeline status cards with stale detection
- Copy button on error logs
- Pagination: MOBILE_PAGE_SIZE=4, DESKTOP_PAGE_SIZE=8

## Bot Mode System

### `src/lib/bot-mode.ts`
- `getBotMode()` reads from `app_settings` JSON under `ai_config.bot_mode` (cached 5 min)
- `shouldBotReply()` returns `{ reply, mode, humanReply? }`
- Three modes:
  - `normal`: active hours only (default 03:00–12:00 WIB)
  - `extended`: 24/7 AI
  - `human`: bot offline, sends "Halo! 🤖 Ijal sedang online sekarang..." template
- Active hours stored in `app_settings` JSON under `ai_config.active_start` / `ai_config.active_end`
- Fallback: DB → `BOT_ACTIVE_START`/`BOT_ACTIVE_END` env → default `03:00`/`12:00`

### Bot Personality
- Alfredo 🤖, DevOps AI Companion milik Christian Rizaldi
- System prompt uses `=== DATA DATABASE ===` / `=== AKHIR DATA ===` markers with few-shot example
- All timestamps converted to WIB via `convertTimestampsToWIB()` before LLM
- Zero-hallucination: empty context → fallback message without LLM call
- Ambiguity detection: `detectAmbiguousProjects()` prepends warning if same repo_name across different groups

## AI / LLM (`src/lib/llm.ts`)
- Provider switchable: `deepseek` (default), `openai`, `gemini`, `ollama`
- All use OpenAI-compatible `/chat/completions` format with raw `fetch`
- Ollama Cloud: `https://ollama.com/api/chat` with `Authorization: Bearer` header
- API keys encrypted with AES-256-GCM, decrypted only during LLM calls
- `askAlfredo()` returns `{ reply, debug }`

## Group Chat Support
- Fonnte: `member` field in payload indicates group message. `sender` = group ID, `member` = actual sender phone
- Evolution: `remoteJid.endsWith('@g.us')` indicates group. `key.participant` = actual sender
- Meta: not yet implemented
- When group detected: bot replies to `groupId` instead of sender's phone
- `IncomingMessage` type includes `isGroup`, `groupId`, `senderName`
- `SendMessageOptions` type includes `isGroup` and `mentions`

## GitLab Integration
- Webhook extracts `project_group` from `path_with_namespace`
- Saves `gitlab_project_id` for API calls
- On pipeline `failed`: auto-fetches last ~2000 chars of job log via PAT → stores in `error_detail`
- On pipeline `success`/`running`: clears `error_detail`
- GitLab PAT stored encrypted in `app_settings`, scope: `api`
- CLI script `scripts/setup-gitlab-webhooks.mjs` for bulk project-level webhook creation

## Search (`src/lib/search.ts`)
- Keyword extraction with stop-word filtering
- Dedup key includes `project_group` — duplicate repo names across groups both appear
- `error_detail` included in search context when present

## Phone Normalization (`src/lib/phone.ts`)
- 08xx → 628xx, +62xx → 62xx, 8xx → 628xx

## Deployment Checklist
1. Set all env vars in Vercel (include `ENCRYPTION_KEY`)
2. Run `supabase/schema.sql` in Supabase SQL Editor
3. Run all migrations (001-004)
4. Disable RLS on `app_settings`
5. Create admin user in Supabase Auth
6. Set Supabase Auth Site URL to deployment URL
7. Enable Realtime for `project_status` and `server_status` tables
8. Configure Fonnte webhook URL to `/api/webhook/fonnte`
9. Insert whitelisted PMs via dashboard `/dashboard/whitelist`
10. Configure AI provider via dashboard `/dashboard/settings`
11. Save GitLab PAT in Dashboard → Settings → GitLab Integration
12. Run `node scripts/setup-gitlab-webhooks.mjs` or set up Group webhook
13. Set up server daemon via Dashboard → Override → Add Server (daemon setup)

## Critical Context
- Supabase: `https://hltaugtnqzqfhgcfvnet.supabase.co`
- Vercel: `https://alfredo-pi.vercel.app`
- Daemon endpoint: `/api/daemon?secret=<ping_secret>`
- Service endpoint: `/api/daemon?type=service&secret=<ping_secret>`
- Metrics bug fixes deployed: CPU uses `/proc/stat` delta, Memory reads MemTotal+MemAvailable, Docker sends on first ping
- Re-download daemon script after any daemon-related code changes