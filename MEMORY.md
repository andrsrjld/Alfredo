# MEMORY.md — Alfredo Project Context

## Project Overview
Alfredo is a WhatsApp-based AI L1 Support bot for a DevOps engineer (Christian) managing 40+ servers and 600+ GitLab repos. Bot answers PM questions during 06:00–12:00 WIB using real-time DB data. Zero-hallucination enforced: bot only answers from DB context.

## Tech Stack
- **Framework**: Next.js 14 App Router (`src/app/`)
- **Database/Auth**: Supabase (PostgreSQL, Auth, Realtime, RLS)
- **Hosting**: Vercel (serverless) — deployed at `https://alfredo-pi.vercel.app`
- **AI**: Multi-provider — DeepSeek (default), OpenAI, Google Gemini, Ollama Cloud (switchable via dashboard or `AI_PROVIDER` env)
- **Messaging**: Multi-provider — Fonnte (active), Meta, Evolution API (switchable via `WA_PROVIDER` env)
- **Styling**: Tailwind CSS v3 + shadcn/ui (base-nova style, `rsc: true`) + dark mode via `next-themes`

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
- Dashboard shows masked keys (`sk-•••••last4`); user must re-enter to change
- Decrypted only server-side during LLM calls

### Messaging Provider
- `WA_PROVIDER` env selects provider: `meta`, `fonnte`, or `evolution`
- **Fonnte is active** — user's Meta account was temporarily blocked
- Fonnte webhook accepts both JSON and formData payloads, with phone normalization for Indonesian formats

### Search & Response
- `src/lib/search.ts` extracts keywords with stop-word filtering
- `src/lib/phone.ts` normalizes Indonesian phone number formats (`08xx→628xx`, `+62xx→62xx`, `8xx→628xx`)
- Empty context → fallback message without calling LLM

### Dark/Light Theme
- `next-themes` package with `class` attribute on `<html>`
- CSS variables for `.dark` already defined in `globals.css`
- Theme toggle (Sun/Moon icons) in dashboard header
- `ThemeProvider` wraps app in `src/components/providers.tsx`

### Mobile-Responsive Dashboard
- Sidebar collapses to hamburger menu on mobile (< md breakpoint)
- Header has theme toggle + sign out
- All pages use `p-4 md:p-6` responsive padding

### Route Structure (Fixed)
- All dashboard pages now under `src/app/(dashboard)/dashboard/`:
  - `/dashboard` — main monitoring view
  - `/dashboard/logs` — chat logs
  - `/dashboard/override` — manual server note editor
  - `/dashboard/settings` — AI provider & API key config
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
- `project_status` — GitLab pipeline statuses (UPSERT by `repo_name`)
- `server_status` — Cron ping from 40+ servers (UPSERT by `server_name`)
- `chat_logs` — PM ↔ bot conversation log
- `whitelisted_pms` — Phone numbers allowed to chat with bot
- `app_settings` — JSONB key-value for dashboard config (currently: `ai_config`)
- RLS enabled on all tables; authenticated users get full access; webhooks use service-role key

## API Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/webhook/gitlab` | POST | Receive GitLab pipeline events |
| `/api/server-ping` | POST | Receive server cron pings |
| `/api/webhook/whatsapp` | GET | Meta webhook verification |
| `/api/webhook/whatsapp` | POST | Meta/Fonnte/Evolution message handler |
| `/api/webhook/fonnte` | POST | Dedicated Fonnte webhook (JSON + formData) |
| `/api/webhook/evolution` | POST | Dedicated Evolution webhook (JSON) |
| `/api/settings` | GET/PUT | AI config (encrypted API keys, provider, temperature) |
| `/api/whitelist` | GET/POST/DELETE | PM whitelist CRUD |
| `/api/auth/signout` | POST | Sign out action |

## Critical Config
- Supabase project: `https://hltaugtnqzqfhgcfvnet.supabase.co`
- Vercel deployment: `https://alfredo-pi.vercel.app`
- `ENCRYPTION_KEY` must be set in Vercel — required for saving/reading encrypted API keys
- `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel
- Vercel env vars required: `SUPABASE_SERVICE_ROLE_KEY`, `FONNTE_API_KEY`, `DEEPSEEK_API_KEY`, `WA_PROVIDER=fonnte`, `AI_PROVIDER=deepseek`, `ENCRYPTION_KEY`, `GITLAB_WEBHOOK_SECRET`, `SERVER_PING_SECRET`, `BOT_ACTIVE_START/END`

## What's Done
- [x] Next.js 14 project init + shadcn/ui + Tailwind v3 + dark mode
- [x] Supabase schema + RLS + trigram indexes
- [x] Supabase clients (browser, server, admin/service-role)
- [x] Auth middleware + login page
- [x] Dashboard UI (realtime server/project status, chat logs, override notes)
- [x] GitLab webhook endpoint
- [x] Server ping endpoint
- [x] Fonnte provider + webhook endpoint (active, tested working)
- [x] Evolution API provider + webhook endpoint
- [x] Messaging provider abstraction (factory pattern)
- [x] Multi-provider LLM integration (DeepSeek, OpenAI, Gemini, Ollama Cloud)
- [x] Smart search (ILIKE keyword on project_status + server_status with stop-word filter)
- [x] Phone number normalization for Indonesian formats
- [x] Dark/light theme with `next-themes`
- [x] Mobile-responsive dashboard with collapsible sidebar
- [x] AI settings dashboard page (provider, API keys, model, temperature)
- [x] Encrypted API key storage (AES-256-GCM)
- [x] Whitelist management dashboard page (add/remove/normalize phone numbers)
- [x] Route fix: logs & override moved to /dashboard/logs & /dashboard/override
- [x] Debug output removed from Fonnte webhook
- [x] Build passes clean, lint passes

## What's Not Done Yet
- [ ] pgvector embedding search (env vars exist, schema not)
- [ ] Pagination on logs/projects for 600+ records
- [ ] Tests (no test framework set up)

## Deployment Checklist
1. Set all env vars in Vercel (add `ENCRYPTION_KEY` — generate with `openssl rand -hex 32`)
2. Run `supabase/schema.sql` in Supabase SQL Editor (if not already)
3. Create admin user in Supabase Auth
4. Set Supabase Auth Site URL to Vercel deployment URL
5. Enable Realtime for `project_status` and `server_status` tables
6. Configure Fonnte webhook URL to point to Vercel
7. Insert whitelisted PMs via dashboard `/dashboard/whitelist`
8. Configure AI provider via dashboard `/dashboard/settings`
9. Set up GitLab Group Webhook → `/api/webhook/gitlab`
10. Set up server cron pings → `/api/server-ping`