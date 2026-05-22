# AGENTS.md

## Commands
- Package manager: `npm` (`package-lock.json` is present).
- Dev server: `npm run dev`; production build: `npm run build`; serve build: `npm run start`.
- Lint: `npm run lint`. No test or standalone typecheck script exists yet. Current baseline is clean after CSS/font/type fixes.

## Setup & Env
- Copy `.env.example` to `.env.local`; Vercel production must define the same env vars manually.
- Run `supabase/schema.sql` in Supabase before using dashboard/webhooks; it creates tables, RLS policies, and trigram indexes.
- `SUPABASE_SERVICE_ROLE_KEY` is only for server-side webhook/admin access via `src/lib/supabase/admin.ts`; never import admin client into Client Components.
- `next.config.mjs` defaults `NEXT_PUBLIC_APP_URL` to `http://localhost:3000` when unset; signout redirects depend on that value.

## Architecture Notes
- App Router lives under `src/app`; alias `@/*` maps to `src/*`.
- Supabase clients are split by trust boundary: browser `src/lib/supabase/client.ts`, auth/server `src/lib/supabase/server.ts`, service-role `src/lib/supabase/admin.ts`.
- Webhook routes: GitLab `src/app/api/webhook/gitlab/route.ts`, WhatsApp/Meta `src/app/api/webhook/whatsapp/route.ts`, Fonnte `src/app/api/webhook/fonnte/route.ts`, Evolution `src/app/api/webhook/evolution/route.ts`, server cron ping `src/app/api/server-ping/route.ts`.
- Messaging providers are abstracted behind `src/lib/messaging/`. Set `WA_PROVIDER` to `meta`, `fonnte`, or `evolution`. Provider-specific env vars are required per choice.
- Dashboard realtime views subscribe directly from Client Components in `src/components/realtime/*`; Supabase Realtime must be enabled for `project_status` and `server_status`.
- shadcn/ui uses `components.json` style `base-nova`, `rsc: true`, and aliases `@/components`, `@/components/ui`, `@/lib/utils`.

## Bot & Search Behavior
- WhatsApp POST ignores non-text messages, then applies active-hours gate (`BOT_ACTIVE_START`, `BOT_ACTIVE_END`, `BOT_TIMEZONE`) before whitelist lookup.
- The `/api/webhook/whatsapp` POST handler also supports Fonnte (formData) and Evolution (JSON) when `WA_PROVIDER` is set accordingly. Each provider also has a dedicated endpoint: `/api/webhook/fonnte`, `/api/webhook/evolution`.
- Alfredo zero-hallucination rule is enforced by `src/lib/llm.ts`: empty DB context returns fallback without calling Groq.
- `AI_PROVIDER` exists in env, but code currently implements Groq only; do not assume Ollama/provider switching works yet.
- Embedding env vars exist, but search is currently simple Supabase `ILIKE` in `src/lib/search.ts`; pgvector is not implemented in `supabase/schema.sql`.

## Routing Gotcha
- Route groups are URL-invisible. Current files map as: `src/app/(dashboard)/dashboard/page.tsx` -> `/dashboard`, `src/app/(dashboard)/logs/page.tsx` -> `/logs`, `src/app/(dashboard)/override/page.tsx` -> `/override`.
- Middleware currently protects paths starting `/dashboard` plus `/login`; if keeping `/logs` or `/override`, extend middleware, or move/nest files to real `/dashboard/logs` and `/dashboard/override` routes.
