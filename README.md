# Alfredo — Enterprise Serverless DevOps Companion

Alfredo is an AI-powered L1 Support chatbot for WhatsApp, designed to answer project manager questions about server and deployment status without waking up the DevOps engineer. It enforces a **zero-hallucination** policy: it only answers based on real-time data from the database, and falls back gracefully when data is unavailable.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  GitLab     │────▶│ /api/webhook/    │────▶│  Supabase    │
│  Webhooks   │     │ gitlab           │     │  (Postgres)  │
└─────────────┘     └──────────────────┘     └──────────────┘
                                                 ▲
┌─────────────┐     ┌──────────────────┐        │
│  40+ Servers│────▶│ /api/server-ping │────────┘
│  (cron)     │     │                  │
└─────────────┘     └──────────────────┘
                                                 ▲
┌─────────────┐     ┌──────────────────┐        │
│  WhatsApp   │────▶│ /api/webhook/    │────▶   │
│  Cloud API  │     │ whatsapp         │        │
└─────────────┘     └──────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Groq API    │
                    │  (LLM)       │
                    └──────────────┘
```

## Key Features

- **WhatsApp Bot** — Responds to whitelisted PMs during configurable active hours (default 06:00–12:00 WIB).
- **Zero-Hallucination** — Alfredo only answers from database context. If data is missing, it returns a polite fallback message.
- **GitLab Integration** — Receives pipeline status updates from GitLab Group Webhooks and stores them in real-time.
- **Server Monitoring** — Accepts cron-based pings from 40+ servers to track online/offline/high_load status.
- **Web Dashboard** — Internal admin UI with Supabase Auth, real-time status cards, chat logs, and manual server note overrides.
- **Smart Search** — Keyword-based retrieval using Supabase `ILIKE` and trigram similarity (pgvector embeddings planned).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Hosting | Vercel (Serverless) |
| Database | Supabase (PostgreSQL, Auth, Realtime) |
| Messaging | WhatsApp Business Cloud API (Meta Graph API v18+) |
| AI Engine | Groq API (`llama-3.1-70b-versatile`) |
| Styling | Tailwind CSS + shadcn/ui |

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase project
- A Groq API key
- (Optional) WhatsApp Business Cloud API credentials

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

### WhatsApp Cloud API

| Variable | How to Generate |
|---|---|
| `WA_PHONE_NUMBER_ID` | [Meta for Developers](https://developers.facebook.com) → Your App → **WhatsApp** → **API Setup** → Phone Number ID |
| `WA_ACCESS_TOKEN` | Meta for Developers → Your App → **WhatsApp** → **API Setup** → **Generate Access Token** (use a permanent token for production) |
| `WA_WEBHOOK_VERIFY_TOKEN` | Self-generated arbitrary string. You choose this value — just use the same one when configuring the Meta webhook. Example: `alfredo_verify_2026` |

### GitLab

| Variable | How to Generate |
|---|---|
| `GITLAB_WEBHOOK_SECRET` | Self-generated arbitrary string. Enter the same value when creating the GitLab Group Webhook. Example: `gl-wh-alfredo-2026` |
| `SERVER_PING_SECRET` | Self-generated arbitrary string. Include this in your server cron ping payloads. Example: `ping-secret-alfredo-2026` |

### AI Provider

| Variable | How to Generate |
|---|---|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → **API Keys** → **Create API Key** |
| `GROQ_MODEL` | Choose from available models at console.groq.com → **Models**. Default: `llama-3.1-70b-versatile` |
| `AI_TEMPERATURE` | Float `0.0`–`1.0`. Lower = more deterministic. Default: `0.0` (zero-hallucination) |

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

# Or use any password manager to generate a 32+ character string
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

#### 2. GitLab Webhook

- Go to your GitLab Group → Settings → Webhooks.
- Add a new webhook pointing to `https://<your-vercel-url>/api/webhook/gitlab`.
- Set the Secret Token to match `GITLAB_WEBHOOK_SECRET`.
- Trigger on **Pipeline events** only.

#### 3. WhatsApp Cloud API

- In Meta for Developers, configure your WhatsApp app webhook URL to `https://<your-vercel-url>/api/webhook/whatsapp`.
- Set the Verify Token to match `WA_WEBHOOK_VERIFY_TOKEN`.
- Subscribe to the `messages` field.

#### 4. Server Cron Pings

On each of your 40+ servers, add a cron job (or systemd timer) that runs every few minutes:

```bash
curl -X POST https://<your-vercel-url>/api/server-ping \
  -H "Content-Type: application/json" \
  -d '{"server_name":"my-server-01","status":"online","secret":"YOUR_SERVER_PING_SECRET"}'
```

Adjust `server_name`, `status`, and `secret` per server.

#### 5. Whitelist PMs

Insert authorized PM phone numbers into the `whitelisted_pms` table in Supabase:

```sql
INSERT INTO whitelisted_pms (phone_number, pm_name)
VALUES ('628123456789', 'John Doe');
```

Phone numbers must be in international format without `+` (e.g., `628123456789`).

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/signout/route.ts    # Sign out action
│   │   ├── server-ping/route.ts     # Server cron ping endpoint
│   │   └── webhook/
│   │       ├── gitlab/route.ts      # GitLab pipeline webhook
│   │       └── whatsapp/route.ts    # WhatsApp Cloud API webhook
│   ├── (auth)/login/page.tsx        # Admin login
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx       # Main monitoring view
│   │   ├── logs/page.tsx            # Chat logs
│   │   ├── override/page.tsx        # Manual server note editor
│   │   └── layout.tsx               # Dashboard shell with sidebar
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Redirects to /dashboard
├── components/
│   ├── realtime/                    # Supabase Realtime subscriptions
│   │   ├── RealtimeServerStatus.tsx
│   │   └── RealtimeProjectStatus.tsx
│   └── ui/                          # shadcn/ui components
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # Browser Supabase client
│   │   ├── server.ts                # Server-side Supabase client (SSR)
│   │   └── admin.ts                 # Service-role client (webhooks, bypasses RLS)
│   ├── llm.ts                       # Groq API wrapper + system prompt
│   ├── search.ts                    # Keyword-based context retrieval
│   └── utils.ts                     # shadcn/ui cn() helper
└── middleware.ts                     # Supabase Auth route protection
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
