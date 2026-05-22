# AGENTS.md

## Commands
- Package manager: `npm` (`package-lock.json` is present).
- Dev server: `npm run dev`; production build: `npm run build`; serve build: `npm run start`.
- Lint: `npm run lint`. No test or standalone typecheck script exists yet.

## Setup & Env
- Copy `.env.example` to `.env.local`; Vercel production must define the same env vars manually.
- Run `supabase/schema.sql` in Supabase before using dashboard/webhooks; it creates tables, RLS policies, and trigram indexes.
- Run migration `supabase/migrations/001_add_columns.sql` to add `ping_secret`, `error_detail`, `gitlab_project_id` columns.
- Run migration `supabase/migrations/002_add_group_support.sql` to add `is_group`, `group_id` columns to `chat_logs`.
- Disable RLS on `app_settings`: `ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;`
- `SUPABASE_SERVICE_ROLE_KEY` must be the actual service_role key (not anon key). Wrong key causes RLS violations on INSERT/UPDATE.
- `ENCRYPTION_KEY` (32-byte hex) is required for AI settings encryption. Generate with `openssl rand -hex 32`. Must be set in Vercel. **If regenerated**, all stored API keys must be re-saved from dashboard.
- `next.config.mjs` defaults `NEXT_PUBLIC_APP_URL` to `http://localhost:3000` when unset; signout redirects depend on that value.

## Architecture Notes
- App Router lives under `src/app`; alias `@/*` maps to `src/*`.
- All dashboard pages under `src/app/(dashboard)/dashboard/`: `/dashboard`, `/dashboard/logs`, `/dashboard/override`, `/dashboard/settings`, `/dashboard/whitelist`.
- Middleware protects all `/dashboard/:path*` routes.
- Supabase clients: browser `src/lib/supabase/client.ts`, server `src/lib/supabase/server.ts`, service-role `src/lib/supabase/admin.ts`.
- Webhook routes: GitLab, WhatsApp/Meta, Fonnte, Evolution, server ping — all in `src/app/api/webhook/`.
- API routes: settings (GET/PUT for AI config + GitLab PAT + bot_mode), whitelist (GET/POST/DELETE), servers (GET/POST/DELETE).
- All API routes must have `export const dynamic = 'force-dynamic'` and `Cache-Control: no-store` — without these, Vercel prerenders routes as static and returns 405.
- Messaging providers abstracted behind `src/lib/messaging/`. Set `WA_PROVIDER` to `meta`, `fonnte`, or `evolution`.
- Dashboard realtime views subscribe directly from Client Components in `src/components/realtime/*`.

## Bot Mode System
- `src/lib/bot-mode.ts`: `getBotMode()` reads `bot_mode` from `app_settings` (cached 5 min), `shouldBotReply()` returns `{ reply, mode, humanReply? }`
- Three modes: `normal` (active hours, default 03:00–12:00 WIB), `extended` (24/7 AI), `human` (bot offline, sends human reply template)
- Human mode reply: "Halo! 🤖 Ijal sedang online sekarang. Silakan hubungi langsung ya — Alfredo standby."
- Dashboard settings page has 3-state toggle UI for bot mode
- `bot_mode` stored in `app_settings` JSON under `ai_config.bot_mode` key
- Active hours (`active_start`, `active_end`) stored in `app_settings` JSON under `ai_config`, configurable from dashboard
- Active hours fallback: DB → `BOT_ACTIVE_START`/`BOT_ACTIVE_END` env → default `03:00`/`12:00`
- System prompt includes active hours from DB config

## Bot & Search Behavior
- Bot personality: Alfredo 🤖, DevOps AI Companion milik Ijal. Style: santai profesional, sapaan "Halo", perkenalkan diri di pesan pertama.
- System prompt uses `=== DATA DATABASE ===` / `=== AKHIR DATA ===` markers with few-shot example.
- All timestamps converted to WIB (Asia/Jakarta) via `convertTimestampsToWIB()` before reaching LLM.
- Ambiguity detection: `detectAmbiguousProjects()` scans context for same `repo_name` across different `project_group` → prepends warning. Search dedup key includes `project_group`.
- Zero-hallucination: empty DB context returns fallback without calling LLM.
- `AI_PROVIDER` env or dashboard settings selects LLM backend: `deepseek`, `openai`, `gemini`, `ollama`. Dashboard settings take priority over env vars.
- API keys encrypted with AES-256-GCM, decrypted only during LLM calls.
- Search uses keyword extraction with stop-word filtering; phone numbers normalized via `src/lib/phone.ts`.
- `error_detail` from GitLab job logs included in search context when present.

## Group Chat Support
- Fonnte: `member` field in webhook payload indicates group message. `sender` = group ID, `member` = actual sender phone.
- Evolution: `remoteJid.endsWith('@g.us')` indicates group. `key.participant` = actual sender. Evolution supports `mentions` array for @mention.
- Meta: group support not yet implemented (needs Group API setup).
- When group message detected: bot replies to group ID (`groupId`) instead of sender's phone number.
- `IncomingMessage` type includes `isGroup`, `groupId`, `senderName` fields.
- `SendMessageOptions` type includes `isGroup` and `mentions` fields.
- Chat logs include `is_group` (boolean) and `group_id` (text) columns.

## GitLab Integration
- GitLab webhook extracts project group from `path_with_namespace`, saves `gitlab_project_id`
- On pipeline `failed`: auto-fetches last ~2000 chars of failed job log via PAT → stores in `error_detail`
- On pipeline `success`/`running`: clears `error_detail`
- GitLab PAT stored encrypted in `app_settings`, scope: `api`
- CLI script `scripts/setup-gitlab-webhooks.mjs` for bulk project-level webhook creation