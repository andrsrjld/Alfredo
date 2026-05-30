export type ServerRecord = {
  id: string
  server_name: string
  ip_address: string | null
  status: string
  notes: string | null
  ping_secret: string | null
  cpu_usage: number | null
  memory_usage: number | null
  disk_usage: number | null
  uptime_hours: number | null
  last_ping: string
}

export type ContainerRecord = {
  id: string
  server_name: string
  container_name: string
  image: string | null
  status: string
  uptime: string | null
  ports: string | null
  error_log: string | null
  last_updated: string
}

function getStaleThresholdMs(): number {
  const msRaw = process.env.STALE_THRESHOLD_MS
  if (msRaw) {
    const ms = Number(msRaw)
    if (Number.isFinite(ms) && ms > 0) return ms
  }

  const secRaw = process.env.STALE_THRESHOLD_SECONDS
  if (secRaw) {
    const sec = Number(secRaw)
    if (Number.isFinite(sec) && sec > 0) return sec * 1000
  }

  // Production data currently arrives much less frequently than once per minute,
  // so keep the default forgiving unless an explicit threshold is configured.
  return 20 * 60_000
}

export const STALE_THRESHOLD_MS = getStaleThresholdMs()
export const APP_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const SERVER_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

export const statusConfig: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'success' | 'warning'; label: string }> = {
  online: { variant: 'success', label: 'Online' },
  offline: { variant: 'destructive', label: 'Offline' },
  high_load: { variant: 'warning', label: 'High load' },
}

export const containerStatusConfig: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'success' | 'warning'; label: string }> = {
  running: { variant: 'success', label: 'Running' },
  exited: { variant: 'destructive', label: 'Exited' },
  dead: { variant: 'destructive', label: 'Dead' },
  restarting: { variant: 'warning', label: 'Restarting' },
  paused: { variant: 'secondary', label: 'Paused' },
  created: { variant: 'secondary', label: 'Created' },
}

export function isStale(server: ServerRecord): boolean {
  if (server.status !== 'online') return false
  return Date.now() - new Date(server.last_ping).getTime() > STALE_THRESHOLD_MS
}

export function hasReportedMetrics(server: ServerRecord): boolean {
  return server.cpu_usage !== null || server.memory_usage !== null || server.disk_usage !== null
}

export function metricsLookEmpty(server: ServerRecord): boolean {
  return hasReportedMetrics(server)
    && (server.cpu_usage ?? 0) === 0
    && (server.memory_usage ?? 0) === 0
    && (server.disk_usage ?? 0) === 0
}

export function staleLabel(server: ServerRecord): string {
  if (!isStale(server)) return ''
  const diff = Date.now() - new Date(server.last_ping).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `Offline`
  return `Offline`
}

export function formatWIB(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function extractServiceName(containerName: string): string {
  // Swarm format: service.slot.task.node → service
  const parts = containerName.split('.')
  if (parts.length >= 3) return parts.slice(0, parts.length - 2).join('.')
  return containerName
}

export function isSwarmStyleName(name: string): boolean {
  // Heuristic: swarm names have at least 3 dot-separated segments
  const parts = name.split('.')
  return parts.length >= 3 && /^\d+$/.test(parts[parts.length - 2])
}

export function groupContainersByService(
  containers: ContainerRecord[]
): { services: Record<string, ContainerRecord[]>; isSwarm: boolean } {
  const swarmCount = containers.filter(c => isSwarmStyleName(c.container_name)).length
  const isSwarm = swarmCount > containers.length * 0.5
  if (!isSwarm) return { services: {}, isSwarm: false }

  const services: Record<string, ContainerRecord[]> = {}
  for (const c of containers) {
    const svc = extractServiceName(c.container_name)
    if (!services[svc]) services[svc] = []
    services[svc].push(c)
  }
  return { services, isSwarm: true }
}

export function getServiceReplicaSummary(containers: ContainerRecord[]): string {
  const running = containers.filter(c => c.status === 'running').length
  const total = containers.length
  return `${running}/${total} up`
}

export function generateSetupInstructions(server: Pick<ServerRecord, 'ping_secret'>, mode: 'daemon' | 'cron'): string {
  const secret = server.ping_secret
  if (!secret) return 'No ping secret available for this server.'
  if (mode === 'daemon') {
    return [
      `# 1. Download daemon script (secrets embedded, bash only):`,
      `sudo curl -fsSL "${APP_URL}/api/daemon?secret=${secret}" -o /usr/local/bin/alfredo-daemon.sh && sudo chmod +x /usr/local/bin/alfredo-daemon.sh`,
      `# 2. Download systemd service unit:`,
      `tmp=$(mktemp) && curl -fsSL "${APP_URL}/api/daemon?secret=${secret}&type=service" -o "$tmp" && sudo install -m 0644 "$tmp" /etc/systemd/system/alfredo-daemon.service && rm -f "$tmp"`,
      `# 3. Enable and start:`,
      `sudo systemctl daemon-reload && sudo systemctl enable --now alfredo-daemon`,
    ].join('\n')
  }
  const crontab = `* * * * * /usr/local/bin/alfredo-ping.sh >> /var/log/alfredo-ping.log 2>&1`
  return [
    `# 1. Download ping script:`,
    `sudo curl -fsSL "${APP_URL}/api/scripts/alfredo-ping.sh?secret=${secret}" -o /usr/local/bin/alfredo-ping.sh && sudo chmod +x /usr/local/bin/alfredo-ping.sh`,
    `# 2. Add to crontab:`,
    `(crontab -l 2>/dev/null; echo "${crontab}") | crontab -`,
  ].join('\n')
}
