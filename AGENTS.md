# AGENTS.md

## Commands
- Package manager: `npm` (`package-lock.json` is present).
- Dev server: `npm run dev`; production build: `npm run build`; serve build: `npm run start`.
- Lint: `npm run lint`. No test or standalone typecheck script exists yet.

## Setup & Env
- Copy `.env.example` to `.env.local`; Vercel production must define the same env vars manually.
- Run `supabase/schema.sql` in Supabase before using dashboard/webhooks; it creates tables, RLS policies, and trigram indexes.
- Run migration `supabase/migrations/001_add_columns.sql` to add `ping_secret`, `error_detail`, `gitlab_project_id` columns.
- Disable RLS on `app_settings`: `ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;`
- `SUPABASE_SERVICE_ROLE_KEY` is only for server-side webhook/admin access via `src/lib/supabase/admin.ts`; never import admin client into Client Components. Must be actual service_role key, not anon key.
- `ENCRYPTION_KEY` (32-byte hex) is required for AI settings encryption. Generate with `openssl rand -hex 32`. Must be set in Vercel. **If regenerated**, all stored API keys must be re-saved from dashboard.
- `next.config.mjs` defaults `NEXT_PUBLIC_APP_URL` to `http://localhost:3000` when unset; signout redirects depend on that value.

## Architecture Notes
- App Router lives under `src/app`; alias `@/*` maps to `src/*`.
- All dashboard pages under `src/app/(dashboard)/dashboard/`: `/dashboard`, `/dashboard/logs`, `/dashboard/override`, `/dashboard/settings`, `/dashboard/whitelist`.
- Middleware protects all `/dashboard/:path*` routes.
- Supabase clients are split by trust boundary: browser `src/lib/supabase/client.ts`, auth/server `src/lib/supabase/server.ts`, service-role `src/lib/supabase/admin.ts`.
- Webhook routes: GitLab `src/app/api/webhook/gitlab/route.ts`, WhatsApp/Meta `src/app/api/webhook/whatsapp/route.ts`, Fonnte `src/app/api/webhook/fonnte/route.ts`, Evolution `src/app/api/webhook/evolution/route.ts`, server cron ping `src/app/api/server-ping/route.ts`.
- API routes: settings `src/app/api/settings/route.ts` (GET/PUT for AI config + GitLab PAT), whitelist `src/app/api/whitelist/route.ts` (GET/POST/DELETE), servers `src/app/api/servers/route.ts` (GET/POST/DELETE).
- All API routes must have `export const dynamic = 'force-dynamic'` and `Cache-Control: no-store` — without these, Vercel prerenders routes as static and returns 405.
- Messaging providers are abstracted behind `src/lib/messaging/`. Set `WA_PROVIDER` to `meta`, `fonnte`, or `evolution`.
- Dashboard realtime views subscribe directly from Client Components in `src/components/realtime/*`; Supabase Realtime must be enabled for `project_status` and `server_status`.
- shadcn/ui uses `components.json` style `base-nova`, `rsc: true`, and aliases `@/components`, `@/components/ui`, `@/lib/utils`.
- Dark/light theme via `next-themes`; ThemeProvider in `src/components/providers.tsx`; ThemeToggle in `src/components/theme-toggle.tsx`.
- Dashboard layout is mobile-responsive: collapsible sidebar with hamburger menu on mobile.

## Bot & Search Behavior
- WhatsApp POST ignores non-text messages, then applies active-hours gate (`BOT_ACTIVE_START`, `BOT_ACTIVE_END`, `BOT_TIMEZONE`) before whitelist lookup.
- Each messaging provider has a dedicated endpoint: `/api/webhook/fonnte`, `/api/webhook/evolution`. The `/api/webhook/whatsapp` POST handler dispatches based on `WA_PROVIDER`.
- Alfredo zero-hallucination rule is enforced by `src/lib/llm.ts`: empty DB context returns fallback without calling LLM.
- Bot personality: Alfredo 🤖, DevOps AI Companion milik Ijal. Style: santai profesional, sapaan "Halo", perkenalkan diri di pesan pertama.
- System prompt uses `=== DATA DATABASE ===` / `=== AKHIR DATA ===` markers with few-shot example.
- All timestamps converted to WIB (Asia/Jakarta) via `convertTimestampsToWIB()` before reaching LLM.
- Ambiguity detection: `detectAmbiguousProjects()` scans context for same `repo_name` across different `project_group` → prepends warning note. System prompt also enforces clarification rule.
- `AI_PROVIDER` env or dashboard settings selects LLM backend: `deepseek` (default), `openai`, `gemini`, `ollama`. All use OpenAI-compatible API format via `fetch`.
- Dashboard AI settings take priority over env vars. Config cached 5 min in memory, invalidated on save.
- API keys encrypted with AES-256-GCM (`src/lib/encryption.ts`) before storing in `app_settings` DB table. Decrypted only during LLM calls.
- Search uses keyword extraction with stop-word filtering (`src/lib/search.ts`); phone numbers are normalized via `src/lib/phone.ts`.
- Dedup key in search includes `project_group` so duplicate repo names across groups both appear in context.
- `error_detail` from GitLab job logs included in search context when present; LLM can analyze and suggest fixes.
- Embedding/pgvector not yet implemented.