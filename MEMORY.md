# MEMORY.md — Alfredo Project Context

## Project Overview
Alfredo is a WhatsApp-based DevOps AI Companion for Ijal (DevOps Engineer) managing 40+ servers and 600+ GitLab repos. Bot answers PM questions during 06:00–12:00 WIB using real-time DB data. Zero-hallucination enforced: bot only answers from DB context. Ambiguity detection: asks PM for clarification when same repo name exists across different GitLab groups.

## Tech Stack
- **Framework**: Next.js 14 App Router (`src/app/`)
- **Database/Auth**: Supabase (PostgreSQL, Auth, Realtime, RLS)
- **Hosting**: Vercel (serverless) — deployed at `https://alfredo-pi.vercel.app`
- **AI**: Multi-provider — DeepSeek, OpenAI, Google Gemini, Ollama Cloud (switchable via dashboard or `AI_PROVIDER` env)
- **Messaging**: Multi-provider — Fonnte (active), Meta, Evolution API (switchable via `WA_PROVIDER` env)
- **Styling**: Tailwind CSS v3 + shadcn/ui (base-nova, `rsc: true`) + dark mode via `next-themes`

## Bot Personality & Language
- Identity: **Alfredo 🤖**, DevOps AI Companion milik Ijal
- Style: santai tapi profesional, sapaan "Halo", jawab ringkas dan to-the-point
- Perkenalkan diri di pesan pertama
- Fallback: "Halo! 🤖 Data untuk pertanyaan itu belum tersedia di sistem saya. Ijal akan follow up secepatnya setelah online ya!"
- Timestamps: semua dikonversi ke WIB (Asia/Jakarta) sebelum masuk ke LLM
- Ambiguity: jika project duplikat (sama repo_name beda group), WAJIB tanya klarifikasi

## Key Decisions & Gotchas

### AI Provider (Multi-Provider)
- `AI_PROVIDER` env or dashboard settings selects LLM backend: `deepseek`, `openai`, `gemini`, `ollama`
- Dashboard stores encrypted API keys in `app_settings` table (AES-256-GCM via `ENCRYPTION_KEY` env var)
- LLM config cached for 5 minutes in memory; cache invalidated on dashboard save
- All 4 providers use OpenAI-compatible `/chat/completions` format; Ollama Cloud at `https://ollama.com/api/chat` with `Authorization: Bearer` header
- System prompt uses `=== DATA DATABASE ===` / `=== AKHIR DATA ===` markers with few-shot example
- `askAlfredo()` returns `{ reply, debug }` — webhooks destructure `const { reply } = await askAlfredo(...)`

### API Key Encryption
- `src/lib/encryption.ts` — AES-256-GCM encryption/decryption
- `ENCRYPTION_KEY` env var (32-byte hex, generate with `openssl rand -hex 32`)
- Dashboard shows masked keys; user must re-enter to change
- Decrypted only server-side during LLM calls
- **If ENCRYPTION_KEY changes** (e.g. Vercel env regenerated), all stored API keys must be re-saved from dashboard

### GitLab Integration
- Webhook extracts project group from `path_with_namespace` field
- Saves `gitlab_project_id` for API calls
- On pipeline `failed`: auto-fetches last ~2000 chars of failed job log via PAT → stores in `error_detail`
- On pipeline `success`/`running`: clears `error_detail`
- GitLab PAT stored encrypted in `app_settings`, scope: `api`
- CLI script `scripts/setup-gitlab-webhooks.mjs` for bulk project-level webhook creation (GitLab free tier workaround)

### Server Monitoring
- Per-server unique `ping_secret` (auto-generated on add, 48-char hex)
- Global `SERVER_PING_SECRET` still works as fallback
- Dashboard "Add Server" generates ready-to-use crontab with copy button
- Server management API: `GET/POST/DELETE /api/servers`

### Ambiguity Detection
- `src/lib/search.ts`: dedup key includes `project_group` so duplicate repo names across groups both appear in context
- `src/lib/llm.ts`: `detectAmbiguousProjects()` scans context for same repo_name + different group → prepends `[PERINGATAN AMBIGUITAS]` note
- System prompt also has rule: WAJIB tanya klarifikasi jika project ambigu

### Timestamp Conversion
- `src/lib/llm.ts`: `toWIB()` converts ISO UTC timestamps to Asia/Jakarta locale string
- `convertTimestampsToWIB()` regex-replaces all timestamps in context before sending to LLM
- System prompt rule: all timestamps are WIB

### Messaging Provider
- `WA_PROVIDER` env selects provider: `meta`, `fonnte`, or `evolution`
- **Fonnte is active** — user's Meta account was temporarily blocked
- Fonnte webhook accepts both JSON and formData payloads, with phone normalization for Indonesian formats

### Search & Response
- `src/lib/search.ts` extracts keywords with stop-word filtering
- `src/lib/phone.ts` normalizes Indonesian phone number formats (`08xx→628xx`, `+62xx→62xx`, `8xx→628xx`)
- Empty context → fallback message without calling LLM

### Vercel Deployment Gotchas
- All API routes need `export const dynamic = 'force-dynamic'` — without it, Vercel prerenders routes as static → returns 405
- All API routes need `Cache-Control: no-store` header to prevent Vercel edge caching
- `SUPABASE_SERVICE_ROLE_KEY` must be the actual service_role key (not anon key) — wrong key causes RLS violations on INSERT/UPDATE
- `app_settings` table has RLS disabled (admin-only table accessed via service-role key)

### Dark/Light Theme
- `next-themes` package with `class` attribute on `<html>`
- CSS variables for `.dark` already defined in `globals.css`
- Theme toggle (Sun/Moon icons) in dashboard header
- `ThemeProvider` wraps app in `src/components/providers.tsx`

### Mobile-Responsive Dashboard
- Sidebar collapses to hamburger menu on mobile (< md breakpoint)
- Header has theme toggle + sign out
- All pages use `p-4 md:p-6` responsive padding

### Route Structure
- All dashboard pages under `src/app/(dashboard)/dashboard/`:
  - `/dashboard` — main monitoring view
  - `/dashboard/logs` — chat logs
  - `/dashboard/override` — server management + note editor + crontab generator
  - `/dashboard/settings` — AI provider, API keys, GitLab PAT config
  - `/dashboard/whitelist` — PM phone number whitelist management
- Middleware protects all `/dashboard/:path*` routes

### CSS/Font Issue (Fixed)
- shadcn v4 `@import "shadcn/tailwind.css"` incompatible with Next.js 14 / Tailwind v3
- Use standard `@tailwind base/components/utilities` + CSS variables
- Geist font from `next/font/google` only works in Next.js 15+; use local fonts

### Supabase Client SSR Issue (Fixed)
- `createClient()` must NOT be called at component top level in Client Components
- Move `createClient()` inside `useEffect` or event handlers

## Database (supabase/schema.sql)
- `project_status` — GitLab pipeline statuses (UPSERT by `repo_name`), columns: `error_detail`, `gitlab_project_id`
- `server_status` — Cron ping (UPSERT by `server_name`), column: `ping_secret` (unique)
- `chat_logs` — PM ↔ bot conversation log
- `whitelisted_pms` — Phone numbers allowed to chat with bot
- `app_settings` — JSONB key-value for dashboard config (`ai_config`), RLS disabled
- RLS enabled on all tables except `app_settings`; authenticated users get full access; webhooks use service-role key

## API Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/webhook/gitlab` | POST | GitLab pipeline events + auto error fetch |
| `/api/server-ping` | POST | Server cron pings (per-server ping_secret + global fallback) |
| `/api/servers` | GET/POST/DELETE | Server management CRUD |
| `/api/webhook/whatsapp` | GET | Meta webhook verification |
| `/api/webhook/whatsapp` | POST | Meta/Fonnte/Evolution message handler |
| `/api/webhook/fonnte` | POST | Dedicated Fonnte webhook (JSON + formData) |
| `/api/webhook/evolution` | POST | Dedicated Evolution webhook (JSON) |
| `/api/settings` | GET/PUT | AI config + GitLab PAT (encrypted keys, masked read) |
| `/api/whitelist` | GET/POST/DELETE | PM whitelist CRUD |
| `/api/auth/signout` | POST | Sign out action |

## Critical Config
- Supabase project: `https://hltaugtnqzqfhgcfvnet.supabase.co`
- Vercel deployment: `https://alfredo-pi.vercel.app`
- `ENCRYPTION_KEY` must be set in Vercel — required for saving/reading encrypted API keys
- `SUPABASE_SERVICE_ROLE_KEY` must be the actual service_role key (not anon)
- All API routes must have `export const dynamic = 'force-dynamic'`

## What's Done
- [x] Next.js 14 project init + shadcn/ui + Tailwind v3 + dark mode
- [x] Supabase schema + RLS + trigram indexes
- [x] Supabase clients (browser, server, admin/service-role)
- [x] Auth middleware + login page
- [x] Dashboard UI (realtime server/project status, chat logs, override notes)
- [x] GitLab webhook endpoint with path_with_namespace + gitlab_project_id
- [x] Auto-fetch failed job logs via GitLab PAT → error_detail
- [x] Server ping endpoint (per-server ping_secret + global fallback)
- [x] Server management API (GET/POST/DELETE) + dashboard "Add Server" with crontab generator
- [x] Fonnte provider + webhook endpoint (active, tested working)
- [x] Evolution API provider + webhook endpoint
- [x] Messaging provider abstraction (factory pattern)
- [x] Multi-provider LLM integration (DeepSeek, OpenAI, Gemini, Ollama Cloud)
- [x] Smart search with project_group dedup + ambiguity detection
- [x] Phone number normalization for Indonesian formats
- [x] Dark/light theme with `next-themes`
- [x] Mobile-responsive dashboard with collapsible sidebar
- [x] AI settings dashboard page (provider, API keys, model, temperature, GitLab PAT)
- [x] Encrypted API key storage (AES-256-GCM)
- [x] Whitelist management dashboard page
- [x] WIB timestamp conversion in LLM context
- [x] Bot personality: Alfredo 🤖, santai profesional, sapaan "Halo", perkenalan diri
- [x] Ambiguity detection: prompt rule + code-level safety net
- [x] CLI script for bulk GitLab webhook creation
- [x] Vercel deployment fixes (force-dynamic, Cache-Control no-store)
- [x] Build passes clean, lint passes

## What's Not Done Yet
- [ ] pgvector embedding search (env vars exist, schema not)
- [ ] Pagination on logs/projects for 600+ records
- [ ] Tests (no test framework set up)
- [ ] DB migration not yet run (ping_secret, error_detail, gitlab_project_id columns)

## Deployment Checklist
1. Set all env vars in Vercel (add `ENCRYPTION_KEY` — generate with `openssl rand -hex 32`)
2. Run `supabase/schema.sql` in Supabase SQL Editor (if not already)
3. Run migration `supabase/migrations/001_add_columns.sql`
4. Disable RLS on `app_settings`: `ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;`
5. Create admin user in Supabase Auth
6. Set Supabase Auth Site URL to Vercel deployment URL
7. Enable Realtime for `project_status` and `server_status` tables
8. Configure Fonnte webhook URL to point to Vercel
9. Insert whitelisted PMs via dashboard `/dashboard/whitelist`
10. Configure AI provider via dashboard `/dashboard/settings`
11. Save GitLab PAT in Dashboard → Settings → GitLab Integration (scope: `api`)
12. Set up GitLab webhooks: `node scripts/setup-gitlab-webhooks.mjs` or Group webhook → `/api/webhook/gitlab`
13. Set up server cron pings via Dashboard → Override → Add Server