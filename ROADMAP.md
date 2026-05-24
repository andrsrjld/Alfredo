# ROADMAP.md — Alfredo v1.0.1

## 🔴 High Impact

### Proactive Alerting
Alfredo push notif ke WhatsApp ketika:
- Server offline (stale >10s)
- Pipeline fail (any branch)
- CPU usage >90%
- Memory usage >90%
- Disk usage >85%
- Container exited

Flow: daemon ping → API detect anomaly → kirim WA via messaging provider ke semua whitelisted contacts dengan `is_active = true`. Toggle per alert type di `/dashboard/settings`.

### Bulk Server Import
Import 40+ server dari CSV/sshm sekali input:
- Textarea: `server_name, ip_address` per line
- Batch insert via `PUT /api/servers`
- Generate single bash script untuk deploy daemon ke semua server via SSH

### Metrics History
Simpan histori CPU/Memory/Disk per server:
- Tabel baru: `metrics_history` (server_name, cpu, memory, disk, timestamp)
- Dashboard grafik: 24h / 7d / 30d
- Pertanyaan WhatsApp: "alfredo cpu prod-01 3 jam terakhir"
- Query: `INSERT INTO metrics_history` per ping + `SELECT ... WHERE timestamp > now() - interval '24h'`

### Daily Health Report
Setiap pagi jam tertentu, Alfredo kirim summary WA:
- "Server X down 2x tadi malam (total 15 menit)"
- "Pipeline A gagal 3x"
- "Container Y OOM-killed"
- Cron via Vercel cron job + messaging provider

---

## 🟡 Medium Impact — Container Control

### Use Cases

| Tugas | Command | Risiko |
|---|---|---|
| Cek status container | `docker ps`, `docker stats` | Read |
| Restart postgresql (prod RAM penuh) | `docker restart postgres` | Safe |
| Scale down swarm service | `docker service scale api=0` | Destructive |
| Restart compose service | `docker compose restart backend` | Safe |
| Lihat log container | `docker logs --tail 200 nginx` | Read |

### Arsitektur: Daemon-Based (dua arah)

Daemon bash yang sudah ada (3s interval) diperpanjang untuk polling perintah — bukan SSH langsung dari Vercel (hindari timeout serverless).

```
User WA: "alfredo restart postgres di prod-01"
    ↓ POST /api/webhook/fonnte
Alfredo (Vercel):
  1. Whitelist + is_active + bot mode check
  2. Parse intent: action=restart, target=postgres, server=prod-01
  3. Resolve server: prod-01 → lookup server_status → IP
  4. Validate: command whitelist (restart ✅, rm ❌)
  5. Cek allowed_servers: user diizinkan akses prod-01?
  6. Insert pending command ke command_queue
  7. Kirim konfirmasi button: [YES] [NO]
    ↓ User tap YES → POST /api/webhook/fonnte (button callback)
  8. Update command_queue: status=confirmed
    ↓ Daemon polling GET /api/server-command?secret=ping_secret
Daemon (bash) di PROD-01:
  1. Tiap 3s: GET /api/server-command → dapat command pending
  2. Execute: docker restart postgres
  3. POST /api/server-command → result: { exit_code, stdout, stderr, duration_ms }
    ↓
Alfredo (Vercel):
  - Deteksi result di polling berikutnya
  - Kirim WA ke user: "✅ postgres restarted (3.2s)"
  - Jika gagal: "❌ postgres restart failed: exit code 1 — container not found"
  - Audit log ke chat_logs + command_queue
```

### Tabel `command_queue`

```sql
CREATE TABLE command_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_name TEXT NOT NULL REFERENCES server_status(server_name),
  command TEXT NOT NULL,
  args JSONB,
  status TEXT DEFAULT 'pending',  -- pending|confirmed|running|success|failed|cancelled|timeout
  requested_by TEXT NOT NULL,
  result TEXT,
  exit_code INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ
);
```

### Command Whitelist di `app_settings`

```json
{
  "command_whitelist": {
    "docker": ["restart", "ps", "logs", "stats", "inspect"],
    "docker-compose": ["restart", "ps", "logs", "up -d", "pull"],
    "docker-swarm": ["service ls", "service ps", "service scale", "service logs"],
    "systemctl": ["status", "restart"],
    "basic": ["df -h", "free -m", "uptime", "top -bn1"]
  }
}
```

### Security: 7-Layer Model

| Layer | Mekanisme | Detail |
|---|---|---|
| 1. Contact Auth | whitelist + `is_active` | Hanya whitelisted contacts yg sudah di-toggle active |
| 2. Command Whitelist | `app_settings.command_whitelist` | Hanya command terdaftar. `docker rm`, `docker stop`, `shutdown` tidak ada di whitelist |
| 3. Per-Server Permission | `allowed_servers TEXT[]` di whitelisted_pms | `["prod-*"]` → cuma server prod. `["*"]` → all. Non-admin users dibatasi |
| 4. Destructive Confirm | 2-step konfirmasi | Read: no confirm. Safe: 1-step button YES/NO. Destructive: ketik CONFIRM |
| 5. Timeout + Auto-Cancel | 5 menit pending → cancel, 60s running → timeout | Hindari command ngegantung |
| 6. Rate Limiting | Max 5 command/jam/user, max 1 destructive/10 menit | Cegah spam/abuse |
| 7. Audit Trail | Semua command dicatat permanen di command_queue | Dashboard `/dashboard/commands` — full history, searchable |

---

## 🟡 Medium Impact — Interactive WhatsApp Buttons

### Tipe Button (Fonnte + Evolution API)

| Tipe | UX | Use Case |
|---|---|---|
| **List Picker** | Scrolling menu 1-10 items | Pilih server, pilih metric, pilih container |
| **Quick Reply** | 2-3 tombol horizontal | Konfirmasi YES/NO, drill-down |
| **CTA URL** | Button buka link | Buka GitLab pipeline log |

### Use Case: Container Control Flow

```
User: "alfredo restart postgres"

Bot: "Pilih server:"
     ┌──────────────────────────┐
     │ 1. PROD-01 (10.0.1.5)     │
     │ 2. PROD-02 (10.0.1.6)     │
     │ 3. DEV-01  (10.0.2.1)     │
     │ [CANCEL]                   │
     └──────────────────────────┘

User tap PROD-01 →

Bot: "⚠️ Restart postgresql di PROD-01?"
     [  ✅ YES, LANJUTKAN  ]
     [  ❌ CANCEL           ]

User tap YES →

Bot: "⏳ Restarting postgres di PROD-01..."
     ...3 detik kemudian...
Bot: "✅ postgres di PROD-01 berhasil direstart (3.2s)"
```

### Use Case: Server Status Drill-down

```
User: "alfredo prod-01"

Bot: "PROD-01 — Online ✅ | CPU 45% | RAM 62%"
     [  📊 Metrics Detail  ]
     [  🐳 Containers (12)  ]
     [  🔧 Pipelines (3)    ]

User tap "Containers" →

Bot: "PROD-01 containers:"
     ┌──────────────────────────┐
     │ postgres — Up 3d (OK)     │
     │ redis — Up 3d (OK)        │
     │ nginx — Exited (OOM) ❌    │
     └──────────────────────────┘
     [  📜 Lihat Log  ] [  🔄 Restart  ]
```

---

## 🟡 Medium Impact — pgvector Semantic Search

### Masalah Saat Ini

ILIKE + trigram: "server yang mati tadi malem" tidak match "offline" di DB.

### Cara Kerja

Ubah text jadi embedding vector (1536 dimensi) yang menangkap makna:
- "mati" ≈ "offline" ≈ "down" ≈ "tidak online"
- "malem" ≈ "tadi malam" ≈ "2024-01-15 02:00 WIB"
- "container mati" ≈ "exited (137)" ≈ "OOM killed"

### Schema Tambahan

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE server_status ADD COLUMN embedding vector(1536);
ALTER TABLE project_status ADD COLUMN embedding vector(1536);
ALTER TABLE container_status ADD COLUMN embedding vector(1536);
CREATE INDEX ON server_status USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON project_status USING ivfflat (embedding vector_cosine_ops);
```

### Embedding Pipeline

```
Data berubah signifikan (status, container, pipeline event):
  1. Build text representation:
     server: "server PROD-01, online, cpu 45%, memory 62%, disk 30%, uptime 14.5 jam"
     pipeline: "pipeline frontend-dashboard, group-a, failed, MODULE_NOT_FOUND error"
     container: "container postgres, running, up 3d, image postgres:15"

  2. Generate embedding via OpenAI text-embedding-3-small
  3. UPSERT ke kolom embedding

  4. Search:
     User: "server mana yang down kemarin weekend?"
     → embedding(query)
     → SELECT *, embedding <=> query_embedding AS distance
       FROM server_status
       WHERE last_ping < now() - interval '3 days'
       ORDER BY distance ASC
       LIMIT 5
```

### Optimasi Biaya

Embedding tidak di-generate tiap 3s ping — hanya saat data berubah signifikan:
- Status server berubah (online ↔ offline)
- Container berubah (up ↔ exited, container baru)
- Pipeline event baru (webhook)
- Atau lokal embedding model (CPU-only, gratis) sebagai alternatif

### Dampak ke Search

`smartSearch()` hybrid: vector first (semantic) → ILIKE fallback (exact keyword) → dedup → format context → LLM.

---

## 🟢 Nice to Have

### Multi-User Dashboard
Lebih dari 1 user dashboard — role: admin (full access), viewer (read-only). Supabase Auth multiple users → whitelist by email.

### Conversation Memory
Alfredo ingat 5 pertanyaan terakhir per user — store context di chat_logs + include di system prompt. "gimana yang tadi?" → konteks dari pesan sebelumnya. Timeout 10 menit.

### Export Logs
Download chat logs dari dashboard — button "Export CSV/JSON" — filterable by date range, phone number.

### Custom Command Plugin
Webhook custom: `/api/webhook/custom/<name>` — user-defined endpoint untuk integrasi eksternal (UptimeRobot, Grafana, Prometheus Alertmanager).

### Docker Swarm/Compose Status
Deteksi stack/compose grouping — group container by service → "backend-api: 2/3 replicas healthy". Perbaiki `groupContainersByService()` untuk detect compose/swarm labels.

### Incident Correlation
Pipeline fail + container exit di server sama → group jadi satu incident. Timeline view + root cause suggestion.

### SSL Certificate Monitor
Cek expiry TLS cert domain — alert 30/14/7 hari sebelum expired via WA. Cron job harian.

---

## 📋 Fase Implementasi (Rekomendasi)

### Fase 1: Container Control + Security (7 file + 2 migration)
Gantikan weekend work — restart postgres, scale down swarm service.

### Fase 2: Interactive Buttons (4 file)
UX untuk konfirmasi command + server drill-down.

### Fase 3: pgvector Semantic Search (5 file + 1 migration)
Search quality — "server mati tadi malem" → hasil akurat.

### Fase 4: Proactive Alerting (3 file)
Bot push notif, tidak tunggu ditanya.
