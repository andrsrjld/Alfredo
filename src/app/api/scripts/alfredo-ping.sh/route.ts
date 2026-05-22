import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SCRIPT = `#!/bin/bash
# Alfredo Server Ping Script
# Auto-generated — secret and URL pre-filled
# Install: copy to /usr/local/bin/alfredo-ping.sh && chmod +x
# Cron:   * * * * * /usr/local/bin/alfredo-ping.sh >> /var/log/alfredo-ping.log 2>&1
#
# Dependencies: curl, jq (docker optional)

PING_URL="{{PING_URL}}"
SECRET="{{SECRET}}"

# --- System Metrics ---
CPU=$(awk -v cpu='cpu' '$1==cpu{printf "%.1f", ($2+$4)*100/($2+$4+$5+$7)}' /proc/stat 2>/dev/null || echo "0")
MEM=$(awk '/MemAvailable/{printf "%.1f", (1-$2/($2+0.001))*100}' /proc/meminfo 2>/dev/null || free | awk '/Mem/{printf "%.1f", $3/$2*100}')
DISK=$(df / | awk 'NR==2{print $5}' | tr -d '%')
UPTIME=$(awk '{printf "%.1f", $1/3600}' /proc/uptime)

# --- Docker Containers ---
TMPFILE=$(mktemp)
CONTAINERS="[]"

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  docker inspect --format '{{.Name}}|{{.Config.Image}}|{{.State.Status}}|{{.State.StartedAt}}|{{.State.ExitCode}}|{{.State.Error}}|{{.NetworkSettings.Ports}}' $(docker ps -aq) 2>/dev/null > "$TMPFILE"

  if [ -s "$TMPFILE" ]; then
    while IFS='|' read -r name image state started_at exit_code state_error ports_raw; do
      [ -z "\${name:-}" ] && continue
      name="\${name#/}"

      UPTIME_STR=""
      ERROR_LOG=""
      PORTS=""

      if [ "\${state:-}" = "running" ]; then
        started_epoch=$(date -d "\${started_at}" +%s 2>/dev/null || echo 0)
        if [ "\${started_epoch}" -gt 0 ] 2>/dev/null; then
          now_epoch=$(date +%s)
          diff=$((now_epoch - started_epoch))
          d=$((diff / 86400))
          h=$(( (diff % 86400) / 3600 ))
          m=$(( (diff % 3600) / 60 ))
          UPTIME_STR="\${d}d \${h}h \${m}m"
        fi
        PORTS=$(echo "\${ports_raw:-}" | tr '\\n' ',' | head -c 200)
      else
        [ "\${exit_code:-}" != "" ] && [ "\${exit_code:-}" != "0" ] && ERROR_LOG="exit_code=\${exit_code}"
        [ -n "\${state_error:-}" ] && ERROR_LOG="\${ERROR_LOG:+\${ERROR_LOG}; }\${state_error}"
      fi

      jq -n \\
        --arg n "\${name:-}" \\
        --arg i "\${image:-}" \\
        --arg s "\${state:-unknown}" \\
        --arg u "\${UPTIME_STR:-}" \\
        --arg p "\${PORTS:-}" \\
        --arg e "\${ERROR_LOG:-}" \\
        '{name:$n,image:$i,status:$s,uptime:$u,ports:$p,error_log:$e}'
    done < "$TMPFILE" | jq -s '.' > "$TMPFILE.json" 2>/dev/null

    CONTAINERS=$(cat "$TMPFILE.json" 2>/dev/null)
    rm -f "$TMPFILE.json"
  fi
fi

rm -f "$TMPFILE"

[ -z "\${CONTAINERS:-}" ] && CONTAINERS="[]"

# --- Build JSON Payload ---
PAYLOAD=$(jq -n \\
  --arg cpu "\${CPU:-0}" \\
  --arg mem "\${MEM:-0}" \\
  --arg disk "\${DISK:-0}" \\
  --arg uptime "\${UPTIME:-0}" \\
  --argjson containers "\${CONTAINERS}" \\
  '{
    cpu: (try ($cpu | tonumber) catch 0),
    memory: (try ($mem | tonumber) catch 0),
    disk: (try ($disk | tonumber) catch 0),
    uptime_hours: (try ($uptime | tonumber) catch 0),
    containers: $containers
  }' 2>/dev/null)

if [ -z "\${PAYLOAD:-}" ]; then
  PAYLOAD='{"cpu":0,"memory":0,"disk":0,"uptime_hours":0,"containers":[]}'
fi

# --- Send ---
RESULT=$(curl -s -w "\\n%{http_code}" -X POST "\${PING_URL}?secret=\${SECRET}" \\
  -H "Content-Type: application/json" \\
  -d "$PAYLOAD" 2>/dev/null)

HTTP_CODE=$(echo "$RESULT" | tail -1)
BODY=$(echo "$RESULT" | head -n -1)
CONTAINER_COUNT=$(echo "\${CONTAINERS}" | jq 'length' 2>/dev/null || echo '0')

if [ "\${HTTP_CODE}" = "200" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') OK - cpu:\${CPU:-0}% mem:\${MEM:-0}% disk:\${DISK:-0}% containers:\${CONTAINER_COUNT}"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') FAIL - HTTP \${HTTP_CODE} - \${BODY}"
fi
`

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!secret) {
    return new NextResponse('# Error: secret query parameter required\n', {
      status: 400,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alfredo-pi.vercel.app'
  const pingUrl = `${baseUrl}/api/server-ping`

  const script = SCRIPT
    .replace('{{PING_URL}}', pingUrl)
    .replace('{{SECRET}}', secret)

  return new NextResponse(script, {
    status: 200,
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Content-Disposition': 'attachment; filename="alfredo-ping.sh"',
      'Cache-Control': 'no-store',
    },
  })
}