'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  APP_URL,
  type ContainerRecord,
  type ServerRecord,
  SERVER_NAME_PATTERN,
  containerStatusConfig,
  formatWIB,
  generateSetupInstructions,
  hasReportedMetrics,
  isStale,
  metricsLookEmpty,
  statusConfig,
  timeAgo,
  extractServiceName,
  groupContainersByService,
  getServiceReplicaSummary,
} from '@/lib/servers'
import { Copy, Check, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

const DIALOG_METRICS_INTERVAL_MS = 5000
const DIALOG_CONTAINERS_INTERVAL_MS = 60000

function containersEqual(a: ContainerRecord[], b: ContainerRecord[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.id !== y.id ||
      x.status !== y.status ||
      x.container_name !== y.container_name ||
      x.image !== y.image ||
      x.uptime !== y.uptime ||
      x.ports !== y.ports ||
      x.error_log !== y.error_log
    ) return false
  }
  return true
}

function mergeServerMetrics(prev: ServerRecord | null, next: ServerRecord): ServerRecord {
  if (!prev) return next
  return {
    ...prev,
    status: next.status,
    cpu_usage: next.cpu_usage,
    memory_usage: next.memory_usage,
    disk_usage: next.disk_usage,
    uptime_hours: next.uptime_hours,
    last_ping: next.last_ping,
    ip_address: next.ip_address,
    notes: next.notes,
    server_name: next.server_name,
  }
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
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function DetailColumn({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0 space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={`break-words text-xs leading-snug text-foreground ${mono ? 'font-mono' : ''}`}>{value || '\u2014'}</p>
    </div>
  )
}

function ContainerItem({ container, expandedLog, onToggleLog }: {
  container: ContainerRecord
  expandedLog: Set<string>
  onToggleLog: (name: string) => void
}) {
  const [copied, setCopied] = useState(false)
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
          <div className="flex items-center gap-2">
            <Button variant="link" size="xs" className="text-destructive p-0" onClick={() => onToggleLog(container.container_name)}>
              {isLogOpen ? 'Hide Log' : 'Show Log'}
            </Button>
            <Button variant="link" size="xs" className="text-muted-foreground p-0" onClick={() => { navigator.clipboard.writeText(container.error_log!); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          {isLogOpen && (
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted px-2 py-1.5 font-mono text-xs text-foreground">{container.error_log}</pre>
          )}
        </div>
      )}
    </div>
  )
}

export type ServerDetailDialogProps = {
  serverId: string | null
  initialServer: ServerRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  editable?: boolean
  showAdminTools?: boolean
  initialShowSetup?: boolean
  onServerUpdated?: (server: ServerRecord) => void
  onServerDeleted?: () => void
}

export default function ServerDetailDialog({
  serverId,
  initialServer,
  open,
  onOpenChange,
  editable = false,
  showAdminTools = false,
  initialShowSetup = false,
  onServerUpdated,
  onServerDeleted,
}: ServerDetailDialogProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [containers, setContainers] = useState<ContainerRecord[]>([])
  const [containerSearch, setContainerSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())
  const [expandedLog, setExpandedLog] = useState<Set<string>>(new Set())
  const [liveServer, setLiveServer] = useState<ServerRecord | null>(null)
  const [containersLoading, setContainersLoading] = useState(false)
  const snapshotRef = useRef<ServerRecord | null>(null)
  const queryNameRef = useRef('')

  const [editName, setEditName] = useState('')
  const [editIp, setEditIp] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [setupMode, setSetupMode] = useState<'daemon' | 'cron'>('daemon')
  const [showSetup, setShowSetup] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!serverId || !open || !initialServer) return
    snapshotRef.current = initialServer
    setLiveServer(initialServer)
    const nameAtOpen = initialServer.server_name
    queryNameRef.current = nameAtOpen
    setEditName(nameAtOpen)
    setEditIp(initialServer.ip_address || '')
    setEditNotes(initialServer.notes || '')
    setSaveError('')
    setSaveOk(false)
    setIsEditing(false)
    setExpandedGroups(new Set())
    setExpandedServices(new Set())
    setShowSetup(initialShowSetup && showAdminTools)

    let active = true
    const supabase = createClient()

    async function fetchContainers(showLoading: boolean) {
      if (showLoading) setContainersLoading(true)
      const { data, error } = await supabase
        .from('container_status')
        .select('*')
        .eq('server_name', queryNameRef.current)
        .order('status', { ascending: true })
      if (!active) return
      if (!error && data) {
        setContainers(prev => (containersEqual(prev, data) ? prev : data))
      }
      if (showLoading) setContainersLoading(false)
    }

    async function fetchServerMetrics() {
      const { data, error } = await supabase
        .from('server_status')
        .select('*')
        .eq('id', serverId!)
        .maybeSingle()
      if (!active || error || !data) return
      const record = data as ServerRecord
      setLiveServer(prev => mergeServerMetrics(prev ?? snapshotRef.current, record))
      if (record.server_name !== queryNameRef.current) {
        queryNameRef.current = record.server_name
        fetchContainers(false)
      }
    }

    fetchContainers(true)
    fetchServerMetrics()
    const metricsInterval = setInterval(fetchServerMetrics, DIALOG_METRICS_INTERVAL_MS)
    const containersInterval = setInterval(() => fetchContainers(false), DIALOG_CONTAINERS_INTERVAL_MS)

    return () => {
      active = false
      clearInterval(metricsInterval)
      clearInterval(containersInterval)
      snapshotRef.current = null
      setLiveServer(null)
      setContainers([])
      setContainersLoading(false)
      setExpandedGroups(new Set())
      setExpandedServices(new Set())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, open])

  if (!initialServer) return null
  const displayServer = liveServer || snapshotRef.current || initialServer
  const stale = isStale(displayServer)
  const cfg = stale
    ? { variant: 'destructive' as const, label: 'Offline' }
    : (statusConfig[displayServer.status] || { variant: 'secondary' as const, label: displayServer.status })
  const pingUrl = displayServer.ping_secret ? `${APP_URL}/api/server-ping?secret=${displayServer.ping_secret}` : null

  const filteredContainers = containers.filter(c =>
    c.container_name.toLowerCase().includes(containerSearch.toLowerCase()) ||
    (c.image || '').toLowerCase().includes(containerSearch.toLowerCase())
  )

  const { isSwarm } = groupContainersByService(filteredContainers)

  const statusGroups = [
    { key: 'running', label: 'Running', variant: 'success' as const },
    { key: 'exited', label: 'Exited', variant: 'destructive' as const },
    { key: 'restarting', label: 'Restarting', variant: 'warning' as const },
    { key: 'dead', label: 'Dead', variant: 'destructive' as const },
    { key: 'others', label: 'Others', variant: 'secondary' as const },
  ]

  function containersByStatus(status: string) {
    if (status === 'others') {
      return filteredContainers.filter(c => !['running', 'exited', 'restarting', 'dead'].includes(c.status))
    }
    return filteredContainers.filter(c => c.status === status)
  }

  function servicesByStatus(status: string) {
    const list = containersByStatus(status)
    const svcMap: Record<string, ContainerRecord[]> = {}
    for (const c of list) {
      const svc = extractServiceName(c.container_name)
      if (!svcMap[svc]) svcMap[svc] = []
      svcMap[svc].push(c)
    }
    return svcMap
  }

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  function toggleService(svc: string) {
    setExpandedServices(prev => {
      const n = new Set(prev)
      if (n.has(svc)) n.delete(svc)
      else n.add(svc)
      return n
    })
  }

  async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleSave() {
    if (!editable || !displayServer.id) return
    const trimmedName = editName.trim()
    if (!SERVER_NAME_PATTERN.test(trimmedName)) {
      setSaveError('Invalid name. Use letters, numbers, dots, hyphens, underscores.')
      return
    }
    setSaving(true)
    setSaveError('')
    setSaveOk(false)
    try {
      const res = await fetch('/api/servers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: displayServer.id,
          server_name: trimmedName,
          ip_address: editIp.trim() || null,
          notes: editNotes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error || 'Failed to save')
        return
      }
      const updated = data.server as ServerRecord
      snapshotRef.current = updated
      setLiveServer(updated)
      queryNameRef.current = updated.server_name
      setEditName(updated.server_name)
      setSaveOk(true)
      onServerUpdated?.(updated)
      setIsEditing(false)
      setTimeout(() => setSaveOk(false), 2000)
    } catch {
      setSaveError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!showAdminTools || !displayServer) return
    if (!confirm(`Delete server "${displayServer.server_name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/servers?server_name=${encodeURIComponent(displayServer.server_name)}`, { method: 'DELETE' })
      if (res.ok) {
        onOpenChange(false)
        onServerDeleted?.()
      }
    } finally {
      setDeleting(false)
    }
  }

  const setupInstructions = generateSetupInstructions(displayServer, setupMode)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-y-auto max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] sm:max-w-lg md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2 pr-8">
            <span className="min-w-0 break-words font-mono">{displayServer.server_name}</span>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </DialogTitle>
          <DialogDescription>Server details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-2.5">
            {displayServer.cpu_usage !== null && (
              <div className={stale ? 'opacity-50' : ''}>
                <MetricBar label="CPU" value={displayServer.cpu_usage} />
              </div>
            )}
            {displayServer.memory_usage !== null && (
              <div className={stale ? 'opacity-50' : ''}>
                <MetricBar label="Memory" value={displayServer.memory_usage} />
              </div>
            )}
            {displayServer.disk_usage !== null && (
              <div className={stale ? 'opacity-50' : ''}>
                <MetricBar label="Disk" value={displayServer.disk_usage} />
              </div>
            )}
            {stale && hasReportedMetrics(displayServer) && (
              <p className="text-xs text-muted-foreground">Last checked {timeAgo(displayServer.last_ping)}</p>
            )}
            {stale && !hasReportedMetrics(displayServer) && (
              <p className="text-xs text-destructive">Server offline — no metrics available.</p>
            )}
            {!stale && !hasReportedMetrics(displayServer) && (
              <p className="text-xs text-muted-foreground">No metrics reported. Re-download ping script and restart the agent.</p>
            )}
            {!stale && metricsLookEmpty(displayServer) && (
              <p className="text-xs text-amber-600">Metrics are all 0% — re-download the latest ping/daemon script.</p>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-xs font-medium text-foreground">Edit server</p>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Server name</label>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="h-8 font-mono text-xs"
                  pattern="^[a-zA-Z0-9][a-zA-Z0-9._-]*$"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">IP address</label>
                <Input
                  value={editIp}
                  onChange={e => setEditIp(e.target.value)}
                  placeholder="10.0.1.5"
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Notes</label>
                <Textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Production app server, contact @ijal..."
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>
              {saveError && <p className="text-xs text-destructive">{saveError}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save changes'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                {saveOk && <span className="text-xs text-muted-foreground">Saved</span>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-1.5 text-xs">
                <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start sm:gap-3">
                  <span className="shrink-0 text-muted-foreground">IP Address</span>
                  <span className="min-w-0 break-words font-mono text-xs sm:text-right">{displayServer.ip_address || '\u2014'}</span>
                </div>
                {displayServer.notes && (
                  <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start sm:gap-3">
                    <span className="shrink-0 text-muted-foreground">Notes</span>
                    <span className="min-w-0 break-words text-xs sm:text-right">{displayServer.notes}</span>
                  </div>
                )}
              </div>
              {editable && (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>Edit server</Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <DetailColumn label="Uptime" value={displayServer.uptime_hours !== null ? `${displayServer.uptime_hours.toFixed(1)}h` : null} mono />
            <DetailColumn label="Last Ping" value={formatWIB(displayServer.last_ping)} mono />
          </div>

          {displayServer.ping_secret && pingUrl && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1.5">
                <span className="text-muted-foreground">Ping Secret</span>
                <Button variant="outline" size="sm" className="h-7 w-full gap-1.5 text-xs" onClick={() => copyToClipboard(displayServer.ping_secret!, 'secret')}>
                  {copied === 'secret' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'secret' ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="space-y-1.5">
                <span className="text-muted-foreground">Ping URL</span>
                <Button variant="outline" size="sm" className="h-7 w-full gap-1.5 text-xs" onClick={() => copyToClipboard(pingUrl, 'url')}>
                  {copied === 'url' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'url' ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}

          {showAdminTools && (
            <div className="space-y-2 border-t border-border pt-3">
              <button
                type="button"
                className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setShowSetup(!showSetup)}
              >
                {showSetup ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Agent setup
              </button>
              {showSetup && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    <Button variant={setupMode === 'daemon' ? 'default' : 'outline'} size="xs" onClick={() => setSetupMode('daemon')}>Realtime</Button>
                    <Button variant={setupMode === 'cron' ? 'default' : 'outline'} size="xs" onClick={() => setSetupMode('cron')}>Cron</Button>
                  </div>
                  <pre className="overflow-x-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap break-all">{setupInstructions}</pre>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => copyToClipboard(setupInstructions, 'setup')}>
                    {copied === 'setup' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy instructions
                  </Button>
                </div>
              )}
              <Button variant="destructive" size="sm" className="gap-2" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Deleting...' : 'Delete server'}
              </Button>
            </div>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground">
                Containers{containers.length > 0 ? ` (${containers.length})` : ''}
                {isSwarm && <span className="ml-1.5 text-muted-foreground font-normal">(Swarm)</span>}
              </span>
              {containers.length > 0 && (
                <Input
                  type="text"
                  placeholder="Filter..."
                  value={containerSearch}
                  onChange={e => { setContainerSearch(e.target.value); setExpandedGroups(new Set()) }}
                  className="h-7 w-full sm:w-28 px-2 text-xs"
                />
              )}
            </div>
            {containersLoading && <p className="text-xs text-muted-foreground">Loading containers...</p>}
            {!containersLoading && containers.length === 0 && (
              <p className="text-xs text-muted-foreground">No containers in database.</p>
            )}
            {containers.length > 0 && (
              <div className="max-h-[40vh] sm:max-h-[50vh] overflow-y-auto pr-1 space-y-1">
                <div className="space-y-1">
                  {statusGroups.map(({ key, label, variant }) => {
                    const groupContainers = containersByStatus(key)
                    if (groupContainers.length === 0) return null
                    const isOpen = expandedGroups.has(key)
                    return (
                      <div key={key} className="rounded-md border border-border">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/30"
                          onClick={() => toggleGroup(key)}
                        >
                          <div className="flex items-center gap-2">
                            {isOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                            <Badge variant={variant} className="text-xs">{label}</Badge>
                            <span className="text-muted-foreground">{groupContainers.length}</span>
                          </div>
                          {isSwarm && (
                            <span className="text-xs text-muted-foreground">
                              {Object.keys(servicesByStatus(key)).length} services
                            </span>
                          )}
                        </button>
                        {isOpen && (
                          <div className="space-y-1 border-t border-border px-3 py-2">
                            {isSwarm ? (
                              Object.entries(servicesByStatus(key)).map(([svcName, svcContainers]) => {
                                const svcOpen = expandedServices.has(svcName)
                                const imageTag = svcContainers[0]?.image?.split('/').pop() || svcContainers[0]?.image || null
                                return (
                                  <div key={svcName} className="rounded-md border border-border/50">
                                    <button
                                      type="button"
                                      className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/20"
                                      onClick={() => toggleService(svcName)}
                                    >
                                      <div className="flex min-w-0 items-center gap-2">
                                        {svcOpen ? <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
                                        <span className="min-w-0 truncate font-mono font-medium">{svcName}</span>
                                        {imageTag && <span className="hidden sm:inline text-muted-foreground truncate">{imageTag}</span>}
                                      </div>
                                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                        {getServiceReplicaSummary(svcContainers)}
                                      </span>
                                    </button>
                                    {svcOpen && (
                                      <div className="space-y-1 border-t border-border/50 px-2.5 py-1.5">
                                        {svcContainers.map(c => (
                                          <ContainerItem
                                            key={c.id}
                                            container={c}
                                            expandedLog={expandedLog}
                                            onToggleLog={(name) => {
                                              setExpandedLog(prev => {
                                                const n = new Set(prev)
                                                if (n.has(name)) n.delete(name)
                                                else n.add(name)
                                                return n
                                              })
                                            }}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            ) : (
                              groupContainers.map(c => (
                                <ContainerItem
                                  key={c.id}
                                  container={c}
                                  expandedLog={expandedLog}
                                  onToggleLog={(name) => {
                                    setExpandedLog(prev => {
                                      const n = new Set(prev)
                                      if (n.has(name)) n.delete(name)
                                      else n.add(name)
                                      return n
                                    })
                                  }}
                                />
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
