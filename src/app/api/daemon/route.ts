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

  const baseUrl = new URL(request.url).origin
  const pingUrl = `${baseUrl}/api/server-ping`
  const serverName = server.server_name
  const interval = Math.max(10, Number(process.env.SERVER_PING_INTERVAL_SECONDS || 60))
  const containerInterval = Math.max(interval, Number(process.env.CONTAINER_PING_INTERVAL_SECONDS || 300))

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
# Metrics broadcaster (${interval}s interval)
# Secret and URL pre-filled
# Install: see setup instructions in dashboard

PING_URL="${pingUrl}"
SECRET="${secret}"
INTERVAL=${interval}
CONTAINER_INTERVAL=${containerInterval}

last_container=-999999
CPU_STATE_FILE="/tmp/alfredo-cpu-\${SECRET:0:8}.state"

read_cpu() {
  local line idle total dt di prev_idle prev_total
  line=$(grep '^cpu ' /proc/stat 2>/dev/null) || { echo "0"; return; }
  idle=$(echo "$line" | awk '{print $5 + $6}')
  total=$(echo "$line" | awk '{s=0; for(i=2;i<=NF;i++) s+=$i; print s}')
  prev_idle=""; prev_total=""
  if [ -f "$CPU_STATE_FILE" ]; then
    read -r prev_idle prev_total < "$CPU_STATE_FILE" 2>/dev/null || true
  fi
  echo "$idle $total" > "$CPU_STATE_FILE"
  if [ -z "$prev_total" ] || [ "$prev_total" = "" ]; then
    echo "0"
    return
  fi
  dt=$((total - prev_total))
  di=$((idle - prev_idle))
  if [ "$dt" -le 0 ]; then
    echo "0"
    return
  fi
  awk -v used=$((dt - di)) -v dt="$dt" 'BEGIN{printf "%.1f", used*100/dt}'
}

read_mem() {
  awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{if(t>0)printf "%.1f",(1-a/t)*100;else print "0"}' /proc/meminfo 2>/dev/null || free | awk '/Mem:/{printf "%.1f",$3/$2*100}'
}

read_disk() {
  df / -P 2>/dev/null | awk 'NR==2{gsub(/%/,"",$5); print $5}' || echo "0"
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
      if command -v docker &>/dev/null; then
        error_log="\$(docker logs --tail 100 "\${name}" 2>&1 | tail -c 2000)"
      fi
    fi
    jq -n \\
      --arg n "\${name:-}" \\
      --arg i "\${image:-}" \\
      --arg s "\${state:-unknown}" \\
      --arg u "\${uptime_str:-}" \\
      --arg p "\${ports:-}" \\
      --arg e "\${error_log:-}" \\
      '{name:$n,image:$i,status:$s,uptime:$u,ports:$p,error_log:$e}'
  done < "$tmpfile" | jq -s '.' 2>/dev/null || echo '[]'
  rm -f "$tmpfile"
}

build_payload() {
  local cpu="$1" mem="$2" disk="$3" uptime="$4" containers_json="$5"
  local out=""
  if [ -n "$containers_json" ] && echo "$containers_json" | jq -e 'type == "array" and length > 0' >/dev/null 2>&1; then
    out=$(jq -n \\
      --arg cpu "$cpu" --arg mem "$mem" --arg disk "$disk" --arg uptime "$uptime" \\
      --argjson containers "$containers_json" \\
      '{
        cpu: (try ($cpu | tonumber) catch 0),
        memory: (try ($mem | tonumber) catch 0),
        disk: (try ($disk | tonumber) catch 0),
        uptime_hours: (try ($uptime | tonumber) catch 0),
        containers: $containers
      }' 2>/dev/null)
  else
    out=$(jq -n \\
      --arg cpu "$cpu" --arg mem "$mem" --arg disk "$disk" --arg uptime "$uptime" \\
      '{
        cpu: (try ($cpu | tonumber) catch 0),
        memory: (try ($mem | tonumber) catch 0),
        disk: (try ($disk | tonumber) catch 0),
        uptime_hours: (try ($uptime | tonumber) catch 0)
      }' 2>/dev/null)
  fi
  if [ -n "$out" ]; then
    echo "$out"
    return
  fi
  if [ -n "$containers_json" ] && echo "$containers_json" | jq -e 'type == "array" and length > 0' >/dev/null 2>&1; then
    printf '{"cpu":%s,"memory":%s,"disk":%s,"uptime_hours":%s,"containers":%s}' "$cpu" "$mem" "$disk" "$uptime" "$containers_json"
  else
    printf '{"cpu":%s,"memory":%s,"disk":%s,"uptime_hours":%s}' "$cpu" "$mem" "$disk" "$uptime"
  fi
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
  payload=$(build_payload "$cpu_val" "$mem_val" "$disk_val" "$uptime_val" "$containers")
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
