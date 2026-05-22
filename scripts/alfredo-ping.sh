#!/bin/bash
# Alfredo Server Ping Script
# Install: copy to /usr/local/bin/alfredo-ping.sh, then add to cron:
#   * * * * * /usr/local/bin/alfredo-ping.sh >> /var/log/alfredo-ping.log 2>&1
#
# Dependencies:curl, docker, jq, awk, free, df, top

PING_URL="https://alfredo-pi.vercel.app/api/server-ping"
SECRET="<YOUR_SERVER_PING_SECRET>"

# --- System Metrics ---
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}')
MEM=$(free | grep Mem | awk '{printf "%.1f", $3/$2*100}')
DISK=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
UPTIME=$(awk '{printf "%.1f", $1/3600}' /proc/uptime)

# --- Docker Containers ---
CONTAINERS="[]"

if command -v docker &>/dev/null; then
  # Check if docker is accessible
  if docker info &>/dev/null; then
    CONTAINERS=$(docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}' 2>/dev/null | while IFS='|' read -r name image status ports; do
      [ -z "$name" ] && continue
      ERROR_LOG=""
      # Only fetch logs for non-running containers
      if [[ "$status" != *"Up"* ]]; then
        ERROR_LOG=$(docker logs --tail 100 "$name" 2>&1 | tail -c 2000 | head -c 2000)
      fi
      # Escape special chars for JSON
      name=$(echo "$name" | sed 's/"/\\"/g')
      image=$(echo "$image" | sed 's/"/\\"/g')
      status=$(echo "$status" | sed 's/"/\\"/g')
      ports=$(echo "$ports" | sed 's/"/\\"/g')
      ERROR_LOG=$(echo "$ERROR_LOG" | sed 's/"/\\"/g' | sed 's/\\/\\\\/g' | tr -d '\r' | head -c 2000)
      printf '{"name":"%s","image":"%s","status":"%s","ports":"%s","error_log":"%s"}\n' \
        "$name" "$image" "$status" "$ports" "$ERROR_LOG"
    done | jq -s '.' 2>/dev/null || echo '[]')
  fi
fi

# --- Build JSON Payload ---
PAYLOAD=$(jq -n \
  --arg cpu "${CPU:-0}" \
  --arg mem "${MEM:-0}" \
  --arg disk "${DISK:-0}" \
  --arg uptime "${UPTIME:-0}" \
  --argjson containers "$CONTAINERS" \
  '{
    cpu: (try ($cpu | tonumber) catch 0),
    memory: (try ($mem | tonumber) catch 0),
    disk: (try ($disk | tonumber) catch 0),
    uptime_hours: (try ($uptime | tonumber) catch 0),
    containers: $containers
  }' 2>/dev/null)

if [ -z "$PAYLOAD" ]; then
  PAYLOAD='{"cpu":0,"memory":0,"disk":0,"uptime_hours":0,"containers":[]}'
fi

# --- Send ---
RESULT=$(curl -s -w "\n%{http_code}" -X POST "${PING_URL}?secret=${SECRET}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" 2>/dev/null)

HTTP_CODE=$(echo "$RESULT" | tail -1)
BODY=$(echo "$RESULT" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') OK - cpu:${CPU:-0}% mem:${MEM:-0}% disk:${DISK:-0}% containers:$(echo "$CONTAINERS" | jq 'length' 2>/dev/null || echo '0')"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') FAIL - HTTP ${HTTP_CODE} - ${BODY}"
fi