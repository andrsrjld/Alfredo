# Docker Deploy

Alfredo can run as a normal long-lived Next.js container. This avoids Vercel Function Invocation limits for high-frequency endpoints such as `/api/server-ping`.

## Supabase

Supabase can stay managed. The app still uses:

- Supabase Auth for dashboard login.
- Supabase Postgres tables and realtime.
- `SUPABASE_SERVICE_ROLE_KEY` only inside server routes.

Keep these rules:

- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or client logs.
- Keep `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as public client values.
- Keep the same `ENCRYPTION_KEY` from production. If it changes, re-save encrypted API keys in Dashboard Settings.
- Update Supabase Auth Site URL and Redirect URLs to the Docker domain.

## First Deploy

1. Copy files to the server.

2. Create the env file:

```bash
cp docker.env.example .env
nano .env
```

Set at least:

- `NEXT_PUBLIC_APP_URL=https://your-domain`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- `WA_PROVIDER`
- provider keys such as `FONNTE_API_KEY`
- webhook secrets such as `WA_WEBHOOK_SECRET` and `GITLAB_WEBHOOK_SECRET`

3. Build and run locally from source:

```bash
docker compose up -d --build
```

Or run the prebuilt GHCR image:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

4. Put a reverse proxy in front of port `3000`.

Example Nginx location:

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

5. Update external webhooks:

- Fonnte: `https://your-domain/api/webhook/fonnte?secret=<WA_WEBHOOK_SECRET>`
- GitLab: `https://your-domain/api/webhook/gitlab`
- Server daemon: re-download setup from Dashboard so scripts point to `NEXT_PUBLIC_APP_URL`.

## Monitoring Cadence

Default Docker env uses:

```bash
SERVER_PING_INTERVAL_SECONDS=60
CONTAINER_PING_INTERVAL_SECONDS=300
STALE_THRESHOLD_SECONDS=180
```

With 8 servers at 60 seconds, traffic becomes about `11,520` ping requests/day instead of `230,400` requests/day at 3 seconds.

After changing cadence or domain, re-download the daemon script on every monitored server:

```bash
sudo curl -sL "https://your-domain/api/daemon?secret=<server_ping_secret>" -o /usr/local/bin/alfredo-daemon.sh
sudo chmod +x /usr/local/bin/alfredo-daemon.sh
sudo systemctl restart alfredo-daemon
```

## Operations

```bash
docker compose logs -f alfredo
docker compose restart alfredo
docker compose pull
docker compose up -d --build
```

For GHCR image deployments:

```bash
docker compose -f docker-compose.prod.yml logs -f alfredo
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## GitHub Container Registry

The GitHub Actions workflow builds and publishes:

```text
ghcr.io/andrsrjld/alfredo:latest
ghcr.io/andrsrjld/alfredo:sha-<commit>
ghcr.io/andrsrjld/alfredo:<tag>
```

Configure these GitHub repository secrets before relying on the pipeline:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional GitHub repository variable:

- `NEXT_PUBLIC_APP_URL` should be set to the Docker domain before production cutover.

If the package is private, log in on the server before pulling:

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u andrsrjld --password-stdin
```
