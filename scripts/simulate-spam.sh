#!/bin/bash
# Simulasi rapid-fire spam message ke Fonnte webhook
# Test message buffer debounce (5 pesan <15 detik → 1 balasan)

WEBHOOK_URL="${1:-https://alfredo-pi.vercel.app/api/webhook/fonnte}"
SENDER="6281234567890"

echo "Simulasi 5 pesan spam dari $SENDER dalam 5 detik..."
echo "URL: $WEBHOOK_URL"
echo "---"

messages=(
  "halo alfredo"
  "server produksi status apa?"
  "yang ion gimana?"
  "pipeline backend-api ada yang gagal?"
  "ada container yang mati gak di dev-01?"
)

for i in "${!messages[@]}"; do
  echo "[$(date '+%H:%M:%S')] Kirim msg$((i+1)): \"${messages[$i]}\""
  curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg sender "$SENDER" \
      --arg message "${messages[$i]}" \
      --arg name "Fahmi Test" \
      '{sender: $sender, message: $message, name: $name}')" \
    -w " → HTTP %{http_code} | %{json}" \
    -o /dev/null
  echo ""

  sleep 1
done

echo "---"
echo "Done. Cek dashboard logs dalam 30-60 detik — harusnya 1 balasan (bukan 5)."
echo "Cek juga: SELECT * FROM message_buffer; — harusnya 1 row untuk $SENDER"
