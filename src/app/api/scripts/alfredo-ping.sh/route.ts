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
read_cpu() {
  local s1 s2
  s1=$(grep '^cpu ' /proc/stat 2>/dev/null) || { echo "0"; return; }
  sleep 1
  s2=$(grep '^cpu ' /proc/stat 2>/dev/null) || { echo "0"; return; }
  awk -v a="$s1" -v b="$s2" 'BEGIN {
    split(a, x); split(b, y)
    idle1 = x[5] + x[6]; idle2 = y[5] + y[6]
    t1 = 0; t2 = 0
    for (i = 2; i <= length(x); i++) t1 += x[i] + 0
    for (i = 2; i <= length(y); i++) t2 += y[i] + 0
    dt = t2 - t1
    if (dt <= 0) { print "0"; exit }
    printf "%.1f", (1 - (idle2 - idle1) / dt) * 100
  }'
}
read_mem() {
  awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{if(t>0)printf "%.1f",(1-a/t)*100;else print "0"}' /proc/meminfo 2>/dev/null \\
    || free | awk '/Mem:/{printf "%.1f", $3/$2*100}'
}
read_disk() {
  df / -P 2>/dev/null | awk 'NR==2{gsub(/%/,"",$5); print $5}' || echo "0"
}
read_uptime() {
  awk '{printf "%.1f", $1/3600}' /proc/uptime 2>/dev/null || echo "0"
}
CPU=$(read_cpu)
MEM=$(read_mem)
DISK=$(read_disk)
UPTIME=$(read_uptime)

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
  PAYLOAD=$(printf '{"cpu":%s,"memory":%s,"disk":%s,"uptime_hours":%s,"containers":%s}' \\
    "\${CPU:-0}" "\${MEM:-0}" "\${DISK:-0}" "\${UPTIME:-0}" "\${CONTAINERS:-[]}")
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