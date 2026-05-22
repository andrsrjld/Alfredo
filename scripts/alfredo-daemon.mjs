#!/usr/bin/env node
// Alfredo Daemon — systemd real-time metrics broadcaster
// Generated dynamically by /api/daemon — secrets embedded at generation time
// Requires: Node.js 18+ (no npm dependencies)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { hostname } from 'node:os'

const SUPABASE_URL = '__SUPABASE_URL__'
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__'
const SERVER_NAME = '__SERVER_NAME__'
const PING_SECRET = '__PING_SECRET__'
const PING_URL = '__PING_URL__'
const BROADCAST_INTERVAL_MS = 2000
const DB_SYNC_INTERVAL_MS = 60000

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const channel = supabase.channel(`server_metrics:${SERVER_NAME}`)

function readCpu(): number {
  try {
    const stat = readFileSync('/proc/stat', 'utf8')
    const cols = stat.split('\n')[0].split(/\s+/).map(Number)
    const idle = cols[3] + cols[4]
    const total = cols.slice(1).reduce((a: number, b: number) => a + b, 0)
    return Math.round((1 - idle / total) * 1000) / 10
  } catch {
    return 0
  }
}

function readMem(): number {
  try {
    const info = readFileSync('/proc/meminfo', 'utf8')
    const total = Number(info.match(/MemTotal:\s+(\d+)/)?.[1] ?? 0)
    const available = Number(info.match(/MemAvailable:\s+(\d+)/)?.[1] ?? 0)
    if (total === 0) return 0
    return Math.round((1 - available / total) * 1000) / 10
  } catch {
    return 0
  }
}

function readDisk(): number {
  try {
    const out = execSync("df / | awk 'NR==2{print $5}'", { encoding: 'utf8' }).trim()
    return Number(out.replace('%', '')) || 0
  } catch {
    return 0
  }
}

function readUptime(): number {
  try {
    const up = readFileSync('/proc/uptime', 'utf8').split(' ')[0]
    return Math.round(Number(up) / 36) / 100
  } catch {
    return 0
  }
}

function readContainers(): Array<{
  name: string
  image: string
  status: string
  uptime: string
  ports: string
  error_log: string
}> {
  try {
    const out = execSync(
      "docker inspect --format '{{.Name}}|{{.Config.Image}}|{{.State.Status}}|{{.State.StartedAt}}|{{.State.ExitCode}}|{{.State.Error}}|{{.NetworkSettings.Ports}}' $(docker ps -aq) 2>/dev/null",
      { encoding: 'utf8', timeout: 30000 }
    )
    if (!out.trim()) return []
    return out.trim().split('\n').map(line => {
      const [name, image, status, startedAt, exitCode, stateError, portsRaw] = line.split('|')
      const cName = (name || '').replace(/^\//, '')
      let uptime = ''
      let errorLog = ''
      if (status === 'running' && startedAt) {
        try {
          const start = new Date(startedAt).getTime()
          const diff = Math.floor((Date.now() - start) / 1000)
          const d = Math.floor(diff / 86400)
          const h = Math.floor((diff % 86400) / 3600)
          const m = Math.floor((diff % 3600) / 60)
          uptime = `${d}d ${h}h ${m}m`
        } catch { /* ignore */ }
      } else if (exitCode && exitCode !== '0') {
        errorLog = `exit_code=${exitCode}`
        if (stateError) errorLog += `; ${stateError}`
      } else if (stateError) {
        errorLog = stateError
      }
      return {
        name: cName,
        image: image || '',
        status: status || 'unknown',
        uptime,
        ports: (portsRaw || '').slice(0, 200),
        error_log: errorLog,
      }
    }).filter(c => c.name)
  } catch {
    return []
  }
}

async function broadcastMetrics() {
  const cpu = readCpu()
  const memory = readMem()
  const disk = readDisk()
  const uptime_hours = readUptime()
  await channel.send({
    type: 'broadcast',
    event: 'metrics',
    payload: { server_name: SERVER_NAME, cpu, memory, disk, uptime_hours },
  })
}

async function syncToDb(containers: ReturnType<typeof readContainers>) {
  const cpu = readCpu()
  const memory = readMem()
  const disk = readDisk()
  const uptime_hours = readUptime()
  const payload = { cpu, memory, disk, uptime_hours, containers }
  try {
    const res = await fetch(`${PING_URL}?secret=${PING_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error(`[sync] DB sync failed: ${res.status}`)
    }
  } catch (err) {
    console.error(`[sync] DB sync error:`, err)
  }
}

async function main() {
  console.log(`[alfredo] Starting daemon for server: ${SERVER_NAME}`)
  console.log(`[alfredo] Broadcast every ${BROADCAST_INTERVAL_MS}ms, DB sync every ${DB_SYNC_INTERVAL_MS}ms`)

  await channel.subscribe((status: string) => {
    console.log(`[alfredo] Channel status: ${status}`)
  })

  let lastDbSync = 0
  let containers: ReturnType<typeof readContainers> = []

  function loop() {
    const now = Date.now()

    // DB sync every 60s with containers
    if (now - lastDbSync >= DB_SYNC_INTERVAL_MS) {
      containers = readContainers()
      syncToDb(containers).catch(console.error)
      lastDbSync = now
    }

    // Broadcast metrics every 2s
    broadcastMetrics().catch(console.error)

    setTimeout(loop, BROADCAST_INTERVAL_MS)
  }

  loop()
}

main().catch(err => {
  console.error('[alfredo] Fatal:', err)
  process.exit(1)
})