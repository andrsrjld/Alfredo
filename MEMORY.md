# MEMORY.md — Alfredo Project Context

## Project Overview
Alfredo is a WhatsApp-based AI L1 Support bot for a DevOps engineer (Christian) managing 40+ servers and 600+ GitLab repos. Bot answers PM questions during 06:00–12:00 WIB using real-time DB data. Zero-hallucination enforced: bot only answers from DB context.

## Tech Stack
- **Framework**: Next.js 14 App Router (`src/app/`)
- **Database/Auth**: Supabase (PostgreSQL, Auth, Realtime, RLS)
- **Hosting**: Vercel (serverless)
- **AI**: Groq API (llama-3.1-70b-versatile, temperature 0.0)
- **Messaging**: Multi-provider — Meta WhatsApp Cloud API, Fonnte, Evolution API (switchable via `WA_PROVIDER` env)
- **Styling**: Tailwind CSS v3 + shadcn/ui (base-nova style, `rsc: true`)

## Key Decisions & Gotchas

### Messaging Provider Switch
- `WA_PROVIDER` env selects provider: `meta`, `fonnte`, or `evolution`
- Each provider has dedicated webhook: `/api/webhook/whatsapp`, `/api/webhook/fonnte`, `/api/webhook/evolution`
- **Fonnte is recommended** for Indonesian users blocked by Meta developer onboarding
- Provider abstraction lives in `src/lib/messaging/` (types, factory, per-provider send logic)
- The `/api/webhook/whatsapp` POST handler dispatches to correct parser based on `WA_PROVIDER`

### CSS/Font Issue (Fixed)
- shadcn v4 `@import "shadcn/tailwind.css"` is incompatible with Next.js 14 / Tailwind v3
- Fix: use standard `@tailwind base/components/utilities` directives + CSS variables in `@layer base`
- `border-border` and `outline-ring/50` needed in tailwind.config.ts `theme.extend.colors`
- Geist font from `next/font/google` only works in Next.js 15+; use local fonts from `./fonts/`

### Supabase Client SSR Issue (Fixed)
- `createClient()` must NOT be called at component top level in Client Components — crashes during `npm run build` if env vars are placeholders
- Fix: move `createClient()` calls inside `useEffect` or event handlers

### Route Group URLs
- `(auth)` and `(dashboard)` are URL-invisible groups
- `/logs` and `/override` are NOT nested under `/dashboard` in URL — middleware only protects `/dashboard/:path*`
- If `/logs` and `/override` need auth protection, extend middleware matcher

### Bot Logic Flow
1. Incoming message → extract sender + text
2. Gatekeeper: active hours check (`BOT_ACTIVE_START/END/TIMEZONE`)
3. Gatekeeper: whitelist check (`whitelisted_pms` table)
4. Smart search: ILIKE keyword on `project_status` and `server_status`
5. LLM: Groq with zero-hallucination system prompt; empty context = fallback without Groq call
6. Send reply via active messaging provider
7. Log to `chat_logs`

## Database (supabase/schema.sql)
- `project_status` — GitLab pipeline statuses (UPSERT by `repo_name`)
- `server_status` — Cron ping from 40+ servers (UPSERT by `server_name`)
- `chat_logs` — PM ↔ bot conversation log
- `whitelisted_pms` — Phone numbers allowed to chat with bot
- `app_settings` — JSONB key-value for future dashboard config
- RLS enabled on all tables; authenticated users get full access; webhooks use service-role key to bypass

## API Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/webhook/gitlab` | POST | Receive GitLab pipeline events |
| `/api/server-ping` | POST | Receive server cron pings |
| `/api/webhook/whatsapp` | GET | Meta webhook verification |
| `/api/webhook/whatsapp` | POST | Meta/Fonnte/Evolution message handler |
| `/api/webhook/fonnte` | POST | Dedicated Fonnte webhook (formData) |
| `/api/webhook/evolution` | POST | Dedicated Evolution webhook (JSON) |
| `/api/auth/signout` | POST | Sign out action |

## Environment Variables (see .env.example for full list)
- `WA_PROVIDER` — switches messaging backend: `meta` | `fonnte` | `evolution`
- Fonnte requires `FONNTE_API_KEY`
- Evolution requires `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`
- Meta requires `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_WEBHOOK_VERIFY_TOKEN`
- `BOT_ACTIVE_START/END/TIMEZONE` controls bot active hours

## What's Done
- [x] Next.js 14 project init + shadcn/ui + Tailwind v3
- [x] Supabase schema + RLS + trigram indexes
- [x] Supabase clients (browser, server, admin/service-role)
- [x] Auth middleware + login page
- [x] Dashboard UI (realtime server/project status, chat logs, override notes)
- [x] GitLab webhook endpoint
- [x] Server ping endpoint
- [x] WhatsApp webhook (Meta) with time gatekeeper + whitelist
- [x] Fonnte provider + webhook endpoint
- [x] Evolution API provider + webhook endpoint
- [x] Messaging provider abstraction (factory pattern)
- [x] Groq LLM integration with zero-hallucination prompt
- [x] Smart search (ILIKE keyword on project_status + server_status)
- [x] Build passes clean (15/15 pages, 0 errors)
- [x] CORS/login fix: Supabase URL must be `.supabase.co` + Site URL configured

## What's Not Done Yet
- [ ] pgvector embedding search (env vars exist, schema not)
- [ ] Dashboard config UI (app_settings table exists, no frontend)
- [ ] Pagination on logs/projects for 600+ records
- [ ] Route auth: `/logs` and `/override` unprotected by middleware
- [ ] Tests (no test framework set up)
- [ ] Actual deployment testing with Fonnte/Evolution providers

## Deployment Checklist
1. Set all `.env` vars in Vercel (especially `NEXT_PUBLIC_SUPABASE_URL` with `.supabase.co` not `.com`)
2. Run `supabase/schema.sql` in Supabase SQL Editor
3. Create admin user in Supabase Auth
4. Set Supabase Auth Site URL to Vercel deployment URL
5. Enable Realtime for `project_status` and `server_status` tables
6. Configure Fonnte/Evolution webhook URL to point to Vercel
7. Insert whitelisted PMs into `whitelisted_pms` table
8. Set up GitLab Group Webhook → `/api/webhook/gitlab`
9. Set up server cron pings → `/api/server-ping`