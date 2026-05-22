# Alfredo — DevOps AI Companion

Alfredo is an AI-powered WhatsApp chatbot that acts as Ijal's DevOps AI Companion. It answers project manager questions about server, pipeline, and deployment status — so Ijal doesn't get woken up. It enforces a **zero-hallucination** policy: answers only from real-time database context, and falls back gracefully when data is unavailable. When project names are ambiguous (same repo name across different GitLab groups), Alfredo asks for clarification before answering.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  GitLab     │────▶│ /api/webhook/    │────▶│  Supabase    │
│  Webhooks   │     │ gitlab           │     │  (Postgres)  │
└─────────────┘     └──────────────────┘     └──────────────┘
                                                 ▲
┌─────────────┐     ┌──────────────────┐         │
│  40+ Servers│────▶│ /api/server-ping │─────────┘
│  (cron)     │     │                  │
└─────────────┘     └──────────────────┘
                                                 ▲
┌─────────────┐     ┌──────────────────┐         │
│  Messaging  │────▶│ /api/webhook/    │─────────┘
│  Provider   │     │ {whatsapp,        │
│  (meta/     │     │  fonnte,          │
│   fonnte/   │     │  evolution}       │
│   evolution)│     └──────────────────┘
└─────────────┘              │
                              ▼
                       ┌──────────────┐
                       │  DeepSeek API │
                       │  (LLM)        │
                       └──────────────┘
```

## Key Features

- **Multi-Provider Messaging** — Choose between Meta WhatsApp Cloud API, **Fonnte** (no Meta approval needed, recommended for Indonesia), or **Evolution API** (self-hosted, free). Switch via `WA_PROVIDER` env var.
- **WhatsApp Bot** — Responds to whitelisted PMs during configurable active hours (default 06:00–12:00 WIB).
- **Zero-Hallucination** — Alfredo only answers from database context with an explicit `=== DATA DATABASE ===` block. If data is missing, it returns a friendly fallback message without calling the LLM.
- **Ambiguity Detection** — When multiple projects share the same repo name across different GitLab groups, Alfredo asks for clarification before answering. Both prompt-level rules and code-level safety net enforce this.
- **WIB Timestamps** — All timestamps are converted to Asia/Jakarta (WIB) before reaching the LLM, so responses use local time.
- **Switchable AI Provider** — Choose between DeepSeek (default), OpenAI, Google Gemini, or Ollama Cloud via dashboard or `AI_PROVIDER` env var. All calls use raw `fetch` to OpenAI-compatible endpoints — no SDK dependency.
- **GitLab Integration** — Receives pipeline status from GitLab webhooks and auto-fetches failed job logs for AI-powered error analysis.
- **Server Monitoring** — Accepts cron-based pings from 40+ servers to track online/offline/high_load status.
- **Web Dashboard** — Internal admin UI with Supabase Auth, real-time status cards, chat logs, and manual server note overrides.
- **Smart Search** — Keyword-based retrieval with stop-word filtering via Supabase `ILIKE` and trigram similarity (pgvector embeddings planned).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Hosting | Vercel (Serverless) |
| Database | Supabase (PostgreSQL, Auth, Realtime) |
| Messaging | Meta WhatsApp Cloud API / Fonnte / Evolution API |
| AI Engine | DeepSeek / OpenAI / Gemini / Ollama Cloud (switchable via dashboard) |
| Styling | Tailwind CSS v3 + shadcn/ui |

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase project
- A DeepSeek API key (or Groq API key)
- A messaging provider account (Fonnte recommended, or Meta WhatsApp, or Evolution API)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values. See [Environment Variables](#environment-variables) below.

### 3. Run database migrations

Execute `supabase/schema.sql` in your Supabase SQL Editor. This creates all tables, RLS policies, and trigram indexes.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root redirects to `/dashboard` (requires Supabase Auth login).

## Environment Variables

### Supabase

| Variable | How to Generate |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → **Settings** → **API** → **Project URL** (use `.supabase.co`, not `.supabase.com`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → **Settings** → **API** → **Project API keys** → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → **Settings** → **API** → **Project API keys** → `service_role` `secret` |

> **Important:** After setting these, go to Supabase Dashboard → **Authentication** → **URL Configuration** and set **Site URL** to your app URL (`http://localhost:3000` for dev, your Vercel URL for prod). Otherwise login will fail with a CORS error.

### Messaging Provider

Set `WA_PROVIDER` to choose your provider: `meta`, `fonnte`, or `evolution`.

#### Fonnte (Recommended — No Meta Approval Needed)

Best choice for Indonesia. Register at [fonnte.com](https://fonnte.com), get an API key, and you're ready.

| Variable | How to Generate |
|---|---|
| `WA_PROVIDER` | Set to `fonnte` |
| `FONNTE_API_KEY` | [fonnte.com](https://fonnte.com) → Dashboard → **API Key** |

#### Meta WhatsApp Cloud API

Official WhatsApp Business API. Requires Meta for Developers account and app review.

| Variable | How to Generate |
|---|---|
| `WA_PROVIDER` | Set to `meta` |
| `WA_PHONE_NUMBER_ID` | [Meta for Developers](https://developers.facebook.com) → Your App → **WhatsApp** → **API Setup** → Phone Number ID |
| `WA_ACCESS_TOKEN` | Meta for Developers → Your App → **WhatsApp** → **API Setup** → **Generate Access Token** (use a permanent token for production) |
| `WA_WEBHOOK_VERIFY_TOKEN` | Self-generated arbitrary string. Use the same value when configuring the Meta webhook. Example: `alfredo_verify_2026` |

#### Evolution API (Self-Hosted, Free)

Open-source WhatsApp API. Requires a VPS to host. [GitHub repo](https://github.com/EvolutionAPI/evolution-api).

| Variable | How to Generate |
|---|---|
| `WA_PROVIDER` | Set to `evolution` |
| `EVOLUTION_API_URL` | Your Evolution API base URL (e.g., `https://evolution.yourdomain.com`) |
| `EVOLUTION_API_KEY` | Set during Evolution API installation |
| `EVOLUTION_INSTANCE_NAME` | Created in Evolution API dashboard after connecting a WhatsApp number |

### AI Provider

Set `AI_PROVIDER` or configure via dashboard: `deepseek` (default), `openai`, `gemini`, or `ollama`. Dashboard settings take priority over env vars.

#### DeepSeek (Default)

| Variable | How to Generate |
|---|---|
| `AI_PROVIDER` | Set to `deepseek` |
| `DEEPSEEK_API_KEY` | [platform.deepseek.com](https://platform.deepseek.com) → **API Keys** → Create |

#### OpenAI

| Variable | How to Generate |
|---|---|
| `AI_PROVIDER` | Set to `openai` |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) → **API Keys** → Create |

#### Google Gemini

| Variable | How to Generate |
|---|---|
| `AI_PROVIDER` | Set to `gemini` |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → **API Keys** → Create |

#### Ollama Cloud

| Variable | How to Generate |
|---|---|
| `AI_PROVIDER` | Set to `ollama` |
| `OLLAMA_API_KEY` | [ollama.com](https://ollama.com) → Account → API Key |

| Variable | Applies to | Description |
|---|---|---|
| `AI_TEMPERATURE` | All | Float `0.0`–`1.0`. Lower = more deterministic. Default: `0.0` (zero-hallucination) |

### GitLab

| Variable | How to Generate |
|---|---|
| `GITLAB_WEBHOOK_SECRET` | Self-generated arbitrary string. Enter the same value when creating the GitLab Group Webhook. Example: `gl-wh-alfredo-2026` |
| `SERVER_PING_SECRET` | Self-generated arbitrary string. Include this in your server cron ping payloads. Example: `ping-secret-alfredo-2026` |

### Bot Config

| Variable | How to Generate |
|---|---|
| `BOT_ACTIVE_START` | Time in `HH:MM` format when bot starts responding. Default: `06:00` |
| `BOT_ACTIVE_END` | Time in `HH:MM` format when bot stops responding. Default: `12:00` |
| `BOT_TIMEZONE` | IANA timezone string. Default: `Asia/Jakarta`. [Full list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) |

### Quick secret generation

For self-generated secrets (`WA_WEBHOOK_VERIFY_TOKEN`, `GITLAB_WEBHOOK_SECRET`, `SERVER_PING_SECRET`), generate a random string:

```bash
# macOS / Linux
openssl rand -hex 24

# Or use any password manager to generate a 48+ character string
```

## Deployment

### Vercel

1. Push this repo to GitLab or GitHub.
2. Connect the repo to a new Vercel project.
3. Set all environment variables listed above in the Vercel project settings.
4. Deploy. Vercel will automatically run `npm run build`.

### Post-Deployment Setup

#### 1. Supabase

- Run `supabase/schema.sql` in the Supabase SQL Editor.
- Create an admin user via Supabase Auth (email/password) for dashboard access.
- Enable Realtime for `project_status` and `server_status` tables in the Supabase dashboard.

#### 2. Messaging Provider Webhook

Choose **one** section based on your `WA_PROVIDER`:

**Fonnte (recommended):**
1. Go to [fonnte.com](https://fonnte.com) dashboard → **Webhook**.
2. Set the webhook URL to `https://<your-vercel-url>/api/webhook/fonnte`.
3. The dedicated endpoint accepts `number` and `message` fields from Fonnte's formData payload.

**Meta WhatsApp Cloud API:**
1. In [Meta for Developers](https://developers.facebook.com), configure your WhatsApp app webhook URL to `https://<your-vercel-url>/api/webhook/whatsapp`.
2. Set the Verify Token to match `WA_WEBHOOK_VERIFY_TOKEN`.
3. Subscribe to the `messages` field.
4. The endpoint also serves GET requests for Meta's webhook verification.

**Evolution API:**
1. In your Evolution API dashboard, set the webhook URL to `https://<your-vercel-url>/api/webhook/evolution`.
2. The dedicated endpoint parses Evolution's JSON message format including `remoteJid` and `body.conversation`.

#### 3. GitLab Webhook

**Option A: Project-level webhooks (works on GitLab Free tier)**

Use the CLI script to bulk-create webhooks for all projects in a group:

```bash
GITLAB_PAT=glpat-xxxxx \
GITLAB_WEBHOOK_SECRET=your_secret \
GITLAB_GROUP_ID=12345 \
node scripts/setup-gitlab-webhooks.mjs
```

**Option B: Group-level webhook (requires GitLab Premium)**

- Go to your GitLab Group → Settings → Webhooks.
- Add a new webhook pointing to `https://<your-vercel-url>/api/webhook/gitlab`.
- Set the Secret Token to match `GITLAB_WEBHOOK_SECRET`.
- Trigger on **Pipeline events** only.

**Error analysis:** Save a GitLab PAT (scope: `api`) in Dashboard → Settings → GitLab Integration. When a pipeline fails, Alfredo auto-fetches the failed job log and stores it in `error_detail` — enabling AI-powered error analysis and suggestions.

#### 4. Server Cron Pings

On each server, add a cron job that runs every 5 minutes. Use the **Add Server** feature in the dashboard (`/dashboard/override`) to auto-generate a unique `ping_secret` and ready-to-use crontab:

```bash
*/5 * * * * curl -s -X POST https://<your-vercel-url>/api/server-ping \
  -H "Content-Type: application/json" \
  -d '{"server_name":"my-server-01","status":"online","ping_secret":"AUTO_GENERATED_SECRET"}' >/dev/null 2>&1
```

Per-server `ping_secret` (recommended) takes priority. The global `SERVER_PING_SECRET` still works as a fallback for existing setups.

#### 5. Whitelist PMs

Insert authorized PM phone numbers into the `whitelisted_pms` table in Supabase:

```sql
INSERT INTO whitelisted_pms (phone_number, pm_name)
VALUES ('628123456789', 'John Doe');
```

Phone numbers must be in international format without `+` (e.g., `628123456789`). The bot normalizes common Indonesian formats (`08xx` → `628xx`, `+62xx` → `62xx`, `8xx` → `628xx`).

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/signout/route.ts        # Sign out action
│   │   ├── server-ping/route.ts          # Server cron ping (per-server ping_secret auth)
│   │   ├── servers/route.ts              # Server management CRUD (GET/POST/DELETE)
│   │   ├── settings/route.ts             # AI config + GitLab PAT (GET/PUT)
│   │   ├── whitelist/route.ts            # PM whitelist CRUD
│   │   └── webhook/
│   │       ├── gitlab/route.ts           # GitLab pipeline webhook + auto error fetch
│   │       ├── whatsapp/route.ts         # Meta WhatsApp webhook (GET verify + POST)
│   │       ├── fonnte/route.ts           # Fonnte webhook (formData + JSON)
│   │       └── evolution/route.ts        # Evolution API webhook (JSON)
│   ├── (auth)/login/page.tsx             # Admin login
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx            # Main monitoring view
│   │   ├── logs/page.tsx                 # Chat logs
│   │   ├── override/page.tsx             # Server management + note editor + crontab gen
│   │   ├── settings/page.tsx             # AI provider, API keys, GitLab PAT config
│   │   ├── whitelist/page.tsx            # PM whitelist management
│   │   └── layout.tsx                    # Dashboard shell with sidebar
│   ├── layout.tsx                        # Root layout
│   └── page.tsx                          # Redirects to /dashboard
├── components/
│   ├── realtime/                         # Supabase Realtime subscriptions
│   │   ├── RealtimeServerStatus.tsx
│   │   └── RealtimeProjectStatus.tsx
│   └── ui/                               # shadcn/ui components
├── lib/
│   ├── messaging/                        # Provider abstraction
│   │   ├── types.ts                      # MessagingProvider interface
│   │   ├── index.ts                      # Factory (getMessagingProvider)
│   │   ├── meta.ts                       # Meta WhatsApp Cloud API
│   │   ├── fonnte.ts                     # Fonnte API
│   │   └── evolution.ts                  # Evolution API
│   ├── supabase/
│   │   ├── client.ts                     # Browser Supabase client
│   │   ├── server.ts                     # Server-side Supabase client (SSR)
│   │   └── admin.ts                      # Service-role client (webhooks, bypasses RLS)
│   ├── encryption.ts                     # AES-256-GCM encrypt/decrypt/maskKey
│   ├── gitlab.ts                         # GitLab PAT fetch + failed job log retrieval
│   ├── llm.ts                            # Multi-provider LLM + system prompt + WIB conversion + ambiguity detection
│   ├── search.ts                         # Keyword-based context retrieval (includes project_group in dedup)
│   ├── phone.ts                          # Indonesia phone number normalization
│   └── utils.ts                          # shadcn/ui cn() helper
├── middleware.ts                          # Supabase Auth route protection
scripts/
├── migrate.sh                            # Local DB migration runner
└── setup-gitlab-webhooks.mjs             # Bulk create GitLab project webhooks
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |

## License

Private — all rights reserved.