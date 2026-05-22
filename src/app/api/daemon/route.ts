import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://alfredo-pi.vercel.app'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

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

  const serverName = server.server_name
  const pingUrl = `${APP_URL}/api/server-ping`

  const script = DAEMON_SCRIPT
    .replace('__SUPABASE_URL__', SUPABASE_URL)
    .replace('__SUPABASE_ANON_KEY__', SUPABASE_ANON_KEY)
    .replace('__SERVER_NAME__', serverName)
    .replace('__PING_SECRET__', secret)
    .replace('__PING_URL__', pingUrl)

  return new NextResponse(script, {
    status: 200,
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Content-Disposition': 'attachment; filename="alfredo-daemon.mjs"',
      'Cache-Control': 'no-store',
    },
  })
}

const DAEMON_SCRIPT = `#!/usr/bin/env node
// Alfredo Daemon — real-time metrics broadcaster
// Server: __SERVER_NAME__
// Auto-generated — secrets embedded
// Install: Node.js 18+, run as systemd service or standalone
//
// Broadcasts CPU/Mem/Disk to Supabase every 2 seconds
// Syncs containers + status to DB every 60 seconds

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const SUPABASE_URL = '__SUPABASE_URL__'
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__'
const SERVER_NAME = '__SERVER_NAME__'
const PING_SECRET = '__PING_SECRET__'
const PING_URL = '__PING_URL__'
const BROADCAST_MS = 2000
const SYNC_MS = 60000

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const channel = supabase.channel('server_metrics:' + SERVER_NAME)

function readCpu() {
  try {
    const stat = readFileSync('/proc/stat', 'utf8')
    const cols = stat.split('\\n')[0].split(/\\s+/).map(Number)
    const idle = cols[3] + cols[4]
    const total = cols.slice(1).reduce((a, b) => a + b, 0)
    return total > 0 ? Math.round((1 - idle / total) * 1000) / 10 : 0
  } catch { return 0 }
}

function readMem() {
  try {
    const info = readFileSync('/proc/meminfo', 'utf8')
    const total = Number(info.match(/MemTotal:\\s+(\\d+)/)?.[1] ?? 0)
    const avail = Number(info.match(/MemAvailable:\\s+(\\d+)/)?.[1] ?? 0)
    return total > 0 ? Math.round((1 - avail / total) * 1000) / 10 : 0
  } catch { return 0 }
}

function readDisk() {
  try {
    return Number(execSync("df / | awk 'NR==2{print $5}'", { encoding: 'utf8' }).trim().replace('%', '')) || 0
  } catch { return 0 }
}

function readUptime() {
  try {
    const up = readFileSync('/proc/uptime', 'utf8').split(' ')[0]
    return Math.round(Number(up) / 36) / 100
  } catch { return 0 }
}

function readContainers() {
  try {
    const out = execSync(
      "docker inspect --format '{{.Name}}|{{.Config.Image}}|{{.State.Status}}|{{.State.StartedAt}}|{{.State.ExitCode}}|{{.State.Error}}|{{.NetworkSettings.Ports}}' $(docker ps -aq) 2>/dev/null",
      { encoding: 'utf8', timeout: 30000 }
    )
    if (!out.trim()) return []
    return out.trim().split('\\n').map(line => {
      const [name, image, status, startedAt, exitCode, stateError, portsRaw] = line.split('|')
      const cName = (name || '').replace(/^\\//, '')
      let uptime = '', errorLog = ''
      if (status === 'running' && startedAt) {
        try {
          const start = new Date(startedAt).getTime()
          const diff = Math.floor((Date.now() - start) / 1000)
          const d = Math.floor(diff / 86400)
          const h = Math.floor((diff % 86400) / 3600)
          const m = Math.floor((diff % 3600) / 60)
          uptime = d + 'd ' + h + 'h ' + m + 'm'
        } catch {}
      } else if (exitCode && exitCode !== '0') {
        errorLog = 'exit_code=' + exitCode
        if (stateError) errorLog += '; ' + stateError
      } else if (stateError) {
        errorLog = stateError
      }
      return { name: cName, image: image || '', status: status || 'unknown', uptime, ports: (portsRaw || '').slice(0, 200), error_log: errorLog }
    }).filter(c => c.name)
  } catch { return [] }
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

async function syncToDb(containers) {
  const payload = {
    cpu: readCpu(),
    memory: readMem(),
    disk: readDisk(),
    uptime_hours: readUptime(),
    containers,
  }
  try {
    const res = await fetch(PING_URL + '?secret=' + PING_SECRET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) console.error('[sync] DB sync failed:', res.status)
  } catch (err) {
    console.error('[sync] DB sync error:', err.message)
  }
}

async function main() {
  console.log('[alfredo] Starting daemon for server:', SERVER_NAME)
  console.log('[alfredo] Broadcast:', BROADCAST_MS + 'ms | DB sync:', SYNC_MS + 'ms')

  await channel.subscribe((status) => {
    console.log('[alfredo] Channel status:', status)
  })

  let lastSync = 0
  let containers = []

  function loop() {
    const now = Date.now()
    if (now - lastSync >= SYNC_MS) {
      containers = readContainers()
      syncToDb(containers).catch(console.error)
      lastSync = now
    }
    broadcastMetrics().catch(console.error)
    setTimeout(loop, BROADCAST_MS)
  }

  loop()
}

main().catch(err => {
  console.error('[alfredo] Fatal:', err)
  process.exit(1)
})
`