'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Copy, Check, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'

type Container = {
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

type Server = {
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

const MOBILE_PAGE_SIZE = 4
const DESKTOP_PAGE_SIZE = 8

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://alfredo-pi.vercel.app'

const statusConfig: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'success' | 'warning'; label: string }> = {
  online: { variant: 'success', label: 'Online' },
  offline: { variant: 'destructive', label: 'Offline' },
  high_load: { variant: 'warning', label: 'High load' },
}

const containerStatusConfig: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'success' | 'warning'; label: string }> = {
  running: { variant: 'success', label: 'Running' },
  exited: { variant: 'destructive', label: 'Exited' },
  dead: { variant: 'destructive', label: 'Dead' },
  restarting: { variant: 'warning', label: 'Restarting' },
  paused: { variant: 'secondary', label: 'Paused' },
  created: { variant: 'secondary', label: 'Created' },
}

function formatWIB(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function MetricBar({ label, value }: { label: string; value: number | null }) {
  if (value === null || value === undefined) return null
  const pct = Math.min(100, Math.max(0, value))
  let color = 'bg-emerald-500'
  if (pct >= 95) color = 'bg-red-500'
  else if (pct >= 80) color = 'bg-amber-500'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-mono ${pct >= 95 ? 'text-red-500' : pct >= 80 ? 'text-amber-500' : 'text-emerald-500'}`}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ServerDetailDialog({ server, open, onOpenChange }: {
  server: Server | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [containers, setContainers] = useState<Container[]>([])
  const [containerSearch, setContainerSearch] = useState('')
  const [showRunning, setShowRunning] = useState(false)
  const [containerPage, setContainerPage] = useState(0)
  const [expandedLog, setExpandedLog] = useState<Set<string>>(new Set())
  const CONTAINER_PAGE_SIZE = 10

  useEffect(() => {
    if (!server || !open) return
    const serverName = server.server_name
    const supabase = createClient()
    async function fetchContainers() {
      const { data } = await supabase
        .from('container_status')
        .select('*')
        .eq('server_name', serverName)
        .order('status', { ascending: true })
      if (data) setContainers(data)
    }
    fetchContainers()
    const channel = supabase
      .channel(`container_status_${serverName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'container_status', filter: `server_name=eq.${serverName}` }, () => {
        fetchContainers()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [server, open])

  if (!server) return null
  const cfg = statusConfig[server.status] || { variant: 'secondary' as const, label: server.status }
  const pingUrl = server.ping_secret ? `${APP_URL}/api/server-ping?secret=${server.ping_secret}` : null

  const problemContainers = containers.filter(c => c.status !== 'running')
  const runningContainers = containers.filter(c => c.status === 'running')
  const filteredProblem = problemContainers.filter(c =>
    c.container_name.toLowerCase().includes(containerSearch.toLowerCase()) ||
    (c.image || '').toLowerCase().includes(containerSearch.toLowerCase())
  )
  const filteredRunning = runningContainers.filter(c =>
    c.container_name.toLowerCase().includes(containerSearch.toLowerCase()) ||
    (c.image || '').toLowerCase().includes(containerSearch.toLowerCase())
  )

  const totalPages = Math.ceil((showRunning ? filteredRunning.length : 0) / CONTAINER_PAGE_SIZE)
  const pagedRunning = showRunning
    ? filteredRunning.slice(containerPage * CONTAINER_PAGE_SIZE, (containerPage + 1) * CONTAINER_PAGE_SIZE)
    : []

  async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  function toggleLog(containerName: string) {
    setExpandedLog(prev => {
      const n = new Set(prev)
      if (n.has(containerName)) n.delete(containerName)
      else n.add(containerName)
      return n
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2 pr-8">
            <span className="min-w-0 break-words font-mono">{server.server_name}</span>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </DialogTitle>
          <DialogDescription>Server details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-2.5">
            {server.cpu_usage !== null && <MetricBar label="CPU" value={server.cpu_usage} />}
            {server.memory_usage !== null && <MetricBar label="Memory" value={server.memory_usage} />}
            {server.disk_usage !== null && <MetricBar label="Disk" value={server.disk_usage} />}
            {server.cpu_usage === null && server.memory_usage === null && server.disk_usage === null && (
              <p className="text-xs text-muted-foreground">No metrics reported. Update cron script to enable.</p>
            )}
          </div>

          <div className="grid gap-1.5 text-xs">
            <DetailRow label="IP Address" value={server.ip_address} mono />
            <DetailRow label="Notes" value={server.notes} />
            <DetailRow label="Uptime" value={server.uptime_hours !== null ? `${server.uptime_hours.toFixed(1)}h` : null} mono />
            <DetailRow label="Last Ping" value={formatWIB(server.last_ping)} mono />
          </div>

          {server.ping_secret && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Ping Secret</span>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <code className="min-w-0 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">{server.ping_secret}</code>
                <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => copyToClipboard(server.ping_secret!, 'secret')}>
                  {copied === 'secret' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}
          {pingUrl && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Ping URL</span>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <code className="min-w-0 whitespace-normal break-all rounded bg-muted px-2 py-1 font-mono text-xs">{pingUrl}</code>
                <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => copyToClipboard(pingUrl, 'url')}>
                  {copied === 'url' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}

          {containers.length > 0 && (
            <div className="border-t border-border pt-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">Containers</span>
                <Input
                  type="text"
                  placeholder="Filter..."
                  value={containerSearch}
                  onChange={e => { setContainerSearch(e.target.value); setContainerPage(0) }}
                  className="h-7 w-28 text-xs px-2"
                />
              </div>

              {filteredProblem.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-destructive">Problem ({filteredProblem.length})</span>
                  {filteredProblem.map(c => (
                    <ContainerItem key={c.id} container={c} expandedLog={expandedLog} onToggleLog={toggleLog} />
                  ))}
                </div>
              )}

              {(showRunning ? filteredRunning : runningContainers).length >= 0 && (
                <div className="space-y-2">
                  <button
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => { setShowRunning(!showRunning); setContainerPage(0) }}
                  >
                    {showRunning ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Running ({filteredRunning.length})
                  </button>
                  {showRunning && pagedRunning.map(c => (
                    <ContainerItem key={c.id} container={c} expandedLog={expandedLog} onToggleLog={toggleLog} />
                  ))}
                  {showRunning && totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <Button variant="outline" size="icon-sm" disabled={containerPage === 0} onClick={() => setContainerPage(p => p - 1)}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-xs text-muted-foreground">{containerPage + 1}/{totalPages}</span>
                      <Button variant="outline" size="icon-sm" disabled={containerPage >= totalPages - 1} onClick={() => setContainerPage(p => p + 1)}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {filteredProblem.length === 0 && filteredRunning.length === 0 && containerSearch && (
                <p className="text-xs text-muted-foreground">No matching containers.</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ContainerItem({ container, expandedLog, onToggleLog }: {
  container: Container
  expandedLog: Set<string>
  onToggleLog: (name: string) => void
}) {
  const cfg = containerStatusConfig[container.status] || { variant: 'secondary' as const, label: container.status }
  const isLogOpen = expandedLog.has(container.container_name)
  const imageTag = container.image ? container.image.split('/').pop() || container.image : null
  return (
    <div className="rounded-md border border-border px-3 py-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-xs font-medium text-foreground">{container.container_name}</span>
        <Badge variant={cfg.variant} className="shrink-0">{cfg.label}</Badge>
      </div>
      <div className="grid gap-0.5 text-xs text-muted-foreground">
        {imageTag && <div className="truncate">Image: <span className="font-mono">{imageTag}</span></div>}
        {container.uptime && <div>Uptime: {container.uptime}</div>}
        {container.ports && <div className="truncate">Ports: <span className="font-mono">{container.ports}</span></div>}
      </div>
      {container.error_log && (
        <div>
          <Button variant="link" size="xs" className="text-destructive p-0" onClick={() => onToggleLog(container.container_name)}>
            {isLogOpen ? 'Hide Log' : 'Show Log'}
          </Button>
          {isLogOpen && (
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted px-2 py-1.5 font-mono text-xs text-foreground">{container.error_log}</pre>
          )}
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start sm:gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={`min-w-0 break-words text-xs sm:text-right ${mono ? 'font-mono' : ''}`}>{value || '\u2014'}</span>
    </div>
  )
}

function ArrowPagination({ page, total, onPrev, onNext }: {
  page: number
  total: number
  onPrev: () => void
  onNext: () => void
}) {
  if (total <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 pt-1">
      <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[3rem] text-center text-xs text-muted-foreground">{page + 1} / {total}</span>
      <Button variant="outline" size="icon-sm" disabled={page >= total - 1} onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

export default function RealtimeServerStatus() {
  const [servers, setServers] = useState<Server[]>([])
  const [mobilePage, setMobilePage] = useState(0)
  const [desktopPage, setDesktopPage] = useState(0)
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function fetchServers() {
      const { data } = await supabase.from('server_status').select('*').order('last_ping', { ascending: false })
      if (data) setServers(data)
    }
    fetchServers()

    const channel = supabase
      .channel('server_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_status' }, () => {
        fetchServers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const mobileTotalPages = Math.ceil(servers.length / MOBILE_PAGE_SIZE)
  const desktopTotalPages = Math.ceil(servers.length / DESKTOP_PAGE_SIZE)
  const desktopItems = servers.slice(desktopPage * DESKTOP_PAGE_SIZE, (desktopPage + 1) * DESKTOP_PAGE_SIZE)

  function renderCard(server: Server, compact?: boolean) {
    const cfg = statusConfig[server.status] || { variant: 'secondary' as const, label: server.status }
    const hasMetrics = server.cpu_usage !== null || server.memory_usage !== null
    return (
      <Card key={server.id} size="sm" className="h-full cursor-pointer" onClick={() => setSelectedServer(server)}>
        <CardContent>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={`truncate font-mono font-medium text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{server.server_name}</span>
            <Badge variant={cfg.variant} className="shrink-0">{cfg.label}</Badge>
          </div>
          <div className={`flex flex-col gap-1 text-muted-foreground ${compact ? 'text-xs' : 'text-sm gap-1.5'}`}>
            <div className="flex items-center justify-between">
              <span>IP</span>
              <span className="font-mono truncate ml-2">{server.ip_address || '\u2014'}</span>
            </div>
            {hasMetrics && (
              <div className="flex items-center justify-between gap-1">
                <span>Load</span>
                <div className="flex items-center gap-1 font-mono text-xs">
                  {server.cpu_usage !== null && <span className={server.cpu_usage >= 80 ? 'text-amber-500' : 'text-emerald-500'}>C:{server.cpu_usage.toFixed(0)}%</span>}
                  {server.memory_usage !== null && <span className={server.memory_usage >= 80 ? 'text-amber-500' : 'text-emerald-500'}>M:{server.memory_usage.toFixed(0)}%</span>}
                  {server.disk_usage !== null && <span className={server.disk_usage >= 80 ? 'text-amber-500' : 'text-emerald-500'}>D:{server.disk_usage.toFixed(0)}%</span>}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>Ping</span>
              <span className="font-mono" title={formatWIB(server.last_ping)}>{timeAgo(server.last_ping)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Mobile: horizontal slider */}
      <div
        data-server-mobile
        className="snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth md:hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex"
        ref={(el) => {
          if (!el) return
          el.onscroll = () => {
            setMobilePage(Math.round(el.scrollLeft / el.offsetWidth))
          }
        }}
      >
        {Array.from({ length: mobileTotalPages }).map((_, pageIdx) => {
          const pageItems = servers.slice(pageIdx * MOBILE_PAGE_SIZE, (pageIdx + 1) * MOBILE_PAGE_SIZE)
          return (
            <div key={pageIdx} className="grid grid-cols-2 gap-3 snap-start" style={{ minWidth: '100%', flexShrink: 0 }}>
              {pageItems.map(s => renderCard(s, true))}
            </div>
          )
        })}
        {servers.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No servers reporting.</p>
        )}
      </div>
      {mobileTotalPages > 1 && (
        <div className="md:hidden">
          <ArrowPagination
            page={mobilePage}
            total={mobileTotalPages}
            onPrev={() => {
              const p = Math.max(0, mobilePage - 1)
              setMobilePage(p)
              const el = document.querySelector('[data-server-mobile]') as HTMLDivElement
              el?.scrollTo({ left: p * el.offsetWidth, behavior: 'smooth' })
            }}
            onNext={() => {
              const p = Math.min(mobileTotalPages - 1, mobilePage + 1)
              setMobilePage(p)
              const el = document.querySelector('[data-server-mobile]') as HTMLDivElement
              el?.scrollTo({ left: p * el.offsetWidth, behavior: 'smooth' })
            }}
          />
        </div>
      )}

      {/* Desktop: paginated grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {desktopItems.map(s => renderCard(s))}
        </div>
        {servers.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No servers reporting.</p>
        )}
      </div>
      {desktopTotalPages > 1 && (
        <div className="hidden md:block">
          <ArrowPagination
            page={desktopPage}
            total={desktopTotalPages}
            onPrev={() => setDesktopPage(p => Math.max(0, p - 1))}
            onNext={() => setDesktopPage(p => Math.min(desktopTotalPages - 1, p + 1))}
          />
        </div>
      )}

      <ServerDetailDialog
        server={selectedServer}
        open={!!selectedServer}
        onOpenChange={(open) => { if (!open) setSelectedServer(null) }}
      />
    </div>
  )
}