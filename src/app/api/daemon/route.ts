import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const type = searchParams.get('type') || 'script'

  if (!secret) {
    return new NextResponse('# Error: secret query parameter required\n', {
      status: 400,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    })
  }

  const supabase = createAdminClient()
  const { data: server } = await supabase
    .from('server_status')
    .select('server_name')
    .eq('ping_secret', secret)
    .maybeSingle()

  if (!server) {
    return new NextResponse('# Error: invalid secret\n', {
      status: 403,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alfredo-pi.vercel.app'
  const pingUrl = `${baseUrl}/api/server-ping`
  const serverName = server.server_name

  if (type === 'service') {
    const unit = `[Unit]
Description=Alfredo Daemon - ${serverName}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
ExecStart=/usr/local/bin/alfredo-daemon.sh
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=alfredo-daemon

[Install]
WantedBy=multi-user.target
`
    return new NextResponse(unit, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="alfredo-daemon.service"', 'Cache-Control': 'no-store' },
    })
  }

  const script = `#!/bin/bash
# Alfredo Daemon - ${serverName}
# Realtime metrics broadcaster (3s interval)
# Secret and URL pre-filled
# Install: see setup instructions in dashboard

PING_URL="${pingUrl}"
SECRET="${secret}"
INTERVAL=3
CONTAINER_INTERVAL=60

last_container=-999999

read_cpu() {
  top -bn1 | grep "Cpu(s)" | awk '{print $2}' 2>/dev/null || echo "0"
}

read_mem() {
  awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{if(t>0)printf "%.1f",(1-a/t)*100;else print "0"}' /proc/meminfo 2>/dev/null || free | awk '/Mem/{printf "%.1f",$3/$2*100}'
}

read_disk() {
  df / | awk 'NR==2{print $5}' | tr -d '%'
}

read_uptime() {
  awk '{printf "%.1f", $1/3600}' /proc/uptime
}

read_containers() {
  if ! command -v docker &>/dev/null || ! docker info &>/dev/null 2>&1; then
    echo '[]'
    return
  fi
  local tmpfile
  tmpfile=$(mktemp)
  docker inspect --format '{{.Name}}|{{.Config.Image}}|{{.State.Status}}|{{.State.StartedAt}}|{{.State.ExitCode}}|{{.State.Error}}|{{.NetworkSettings.Ports}}' $(docker ps -aq) 2>/dev/null > "$tmpfile"
  if [ ! -s "$tmpfile" ]; then
    rm -f "$tmpfile"
    echo '[]'
    return
  fi
  local first=1
  echo -n '['
  while IFS='|' read -r name image state started_at exit_code state_error ports_raw; do
    [ -z "\${name:-}" ] && continue
    name="\${name#/}"
    local uptime_str="" error_log="" ports=""
    if [ "\${state:-}" = "running" ]; then
      started_epoch=$(date -d "\${started_at}" +%s 2>/dev/null || echo 0)
      if [ "\${started_epoch}" -gt 0 ] 2>/dev/null; then
        now_epoch=$(date +%s)
        diff=$((now_epoch - started_epoch))
        uptime_str="\$((diff / 86400))d \$(( (diff % 86400) / 3600 ))h \$(( (diff % 3600) / 60 ))m"
      fi
      ports=$(echo "\${ports_raw:-}" | tr '\\n' ',' | head -c 200)
    else
      [ "\${exit_code:-}" != "" ] && [ "\${exit_code:-}" != "0" ] && error_log="exit_code=\${exit_code}"
      [ -n "\${state_error:-}" ] && error_log="\${error_log:+\${error_log}; }\${state_error}"
    fi
    [ $first -eq 1 ] && first=0 || echo -n ','
    printf '{"name":"%s","image":"%s","status":"%s","uptime":"%s","ports":"%s","error_log":"%s"}' "\${name:-}" "\${image:-}" "\${state:-unknown}" "\${uptime_str:-}" "\${ports:-}" "\${error_log:-}"
  done < "$tmpfile"
  echo -n ']'
  rm -f "$tmpfile"
}

send_ping() {
  local cpu_mem_disk_uptime containers payload
  cpu_mem_disk_uptime="\$(read_cpu) \$(read_mem) \$(read_disk) \$(read_uptime)"
  containers=''
  local now
  now=$(date +%s)
  if [ $((now - last_container)) -ge $CONTAINER_INTERVAL ]; then
    containers=$(read_containers)
    last_container=$now
  fi
   read -r cpu_val mem_val disk_val uptime_val <<< "$cpu_mem_disk_uptime"
   # Debug: log values before sending
   echo "[debug] CPU=$cpu_val MEM=$mem_val DISK=$disk_val UPTIME=$uptime_val" >&2
   echo "[debug] payload before jq: cpu=$cpu_val mem=$mem_val disk=$disk_val" >&2
   if [ -n "$containers" ]; then
    payload=$(jq -n --arg cpu "$cpu_val" --arg mem "$mem_val" --arg disk "$disk_val" --arg uptime "$uptime_val" --argjson containers "$containers" '{cpu:($cpu|tonumber?//0),memory:($mem|tonumber?//0),disk:($disk|tonumber?//0),uptime_hours:($uptime|tonumber?//0),containers:$containers}' 2>/dev/null)
  else
    payload=$(jq -n --arg cpu "$cpu_val" --arg mem "$mem_val" --arg disk "$disk_val" --arg uptime "$uptime_val" '{cpu:($cpu|tonumber?//0),memory:($mem|tonumber?//0),disk:($disk|tonumber?//0),uptime_hours:($uptime|tonumber?//0)}' 2>/dev/null)
  fi
  echo "[debug] payload: $payload" >&2
  [ -z "$payload" ] && payload='{\"cpu\":0,\"memory\":0,\"disk\":0,\"uptime_hours\":0}'
  result=$(curl -s -w "\\n%{http_code}" -X POST "\${PING_URL}?secret=\${SECRET}" -H "Content-Type: application/json" -d "$payload" 2>/dev/null)
  http_code=$(echo "$result" | tail -1)
  if [ "$http_code" = "200" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') OK cpu:\${cpu_val}% mem:\${mem_val}% disk:\${disk_val}%"
  else
    body=$(echo "$result" | head -n -1)
    echo "$(date '+%Y-%m-%d %H:%M:%S') FAIL HTTP \${http_code} - \${body}"
  fi
}

echo "[alfredo] Starting daemon for ${serverName} (interval=\${INTERVAL}s, containers every \${CONTAINER_INTERVAL}s)"
while true; do
  send_ping
  sleep $INTERVAL
done
`

  return new NextResponse(script, {
    status: 200,
    headers: { 'Content-Type': 'text/x-shellscript; charset=utf-8', 'Content-Disposition': 'attachment; filename="alfredo-daemon.sh"', 'Cache-Control': 'no-store' },
  })
}