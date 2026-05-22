'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Copy, Check, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Server = {
  id: string
  server_name: string
  ip_address: string | null
  status: string
  notes: string | null
  last_ping: string
  ping_secret?: string | null
}

const statusConfig: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'success' | 'warning'; label: string }> = {
  online: { variant: 'success', label: 'Online' },
  offline: { variant: 'destructive', label: 'Offline' },
  high_load: { variant: 'warning', label: 'High load' },
}

export default function OverridePage() {
  const [servers, setServers] = useState<Server[]>([])
  const [editNote, setEditNote] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addIp, setAddIp] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [setupMode, setSetupMode] = useState<'daemon' | 'cron'>('daemon')
  const [daemonInstructions, setDaemonInstructions] = useState('')
  const [cronInstructions, setCronInstructions] = useState('')
  const [pingUrl, setPingUrl] = useState('')
  const [copied, setCopied] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function fetchServers() {
      const { data } = await supabase.from('server_status').select('*').order('last_ping', { ascending: false })
      if (data) {
        setServers(data)
        const map: Record<string, string> = {}
        for (const s of data) map[s.id] = s.notes || ''
        setEditNote(map)
      }
    }
    fetchServers()
  }, [])

  async function handleUpdate(id: string) {
    const supabase = createClient()
    setSavingId(id)
    setSaved(prev => { const n = new Set(prev); n.delete(id); return n })
    const { error } = await supabase
      .from('server_status')
      .update({ notes: editNote[id] || null })
      .eq('id', id)
    if (!error) {
      setSaved(prev => { const n = new Set(prev); n.add(id); return n })
    }
    setSavingId(null)
  }

  async function handleAddServer(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    setAdding(true)
    setDaemonInstructions('')
    setCronInstructions('')
    setPingUrl('')
    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_name: addName.trim(), ip_address: addIp.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddError(data.error || 'Failed to add server')
        return
      }
      if (data.daemon_instructions) setDaemonInstructions(data.daemon_instructions)
      if (data.cron_instructions) setCronInstructions(data.cron_instructions)
      if (data.ping_url) setPingUrl(data.ping_url)
      if (data.server) {
        setServers(prev => [data.server, ...prev])
        setEditNote(prev => ({ ...prev, [data.server.id]: '' }))
      }
      setAddName('')
      setAddIp('')
    } catch {
      setAddError('Network error')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(serverName: string, id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/servers?server_name=${encodeURIComponent(serverName)}`, { method: 'DELETE' })
      if (res.ok) {
        setServers(prev => prev.filter(s => s.id !== id))
        setEditNote(prev => { const n = { ...prev }; delete n[id]; return n })
      }
    } catch {
    } finally {
      setDeleting(null)
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(prev => { const n = new Set(prev); n.add(key); return n })
    setTimeout(() => setCopied(prev => { const n = new Set(prev); n.delete(key); return n }), 2000)
  }

  const activeInstructions = setupMode === 'daemon' ? daemonInstructions : cronInstructions

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 lg:p-6 xl:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Manage servers and override notes.</p>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4" /> Add Server
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader><CardDescription>Add Server</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleAddServer} className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className="label-sm mb-2 block">Server Name</label>
                <Input
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="app-prod-01"
                  required
                  pattern="^[a-zA-Z0-9][a-zA-Z0-9._-]*$"
                  className="font-mono"
                />
              </div>
              <div>
                <label className="label-sm mb-2 block">IP Address (optional)</label>
                <Input
                  value={addIp}
                  onChange={e => setAddIp(e.target.value)}
                  placeholder="10.0.1.5"
                  className="font-mono"
                />
              </div>
              <Button type="submit" disabled={adding || !addName.trim()}>
                {adding ? 'Adding...' : 'Add'}
              </Button>
            </form>
            {addError && <p className="text-sm text-destructive">{addError}</p>}
            {(daemonInstructions || cronInstructions) && (
              <div className="space-y-3 pt-2">
                {pingUrl && (
                  <div className="space-y-1.5">
                    <p className="label-sm">Ping URL</p>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <code className="min-w-0 overflow-x-auto rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">{pingUrl}</code>
                      <Button variant="ghost" size="icon-xs" onClick={() => copyToClipboard(pingUrl, 'url')}>
                        {copied.has('url') ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="label-sm">Setup Mode</p>
                    <div className="flex gap-1">
                      <Button
                        variant={setupMode === 'daemon' ? 'default' : 'outline'}
                        size="xs"
                        onClick={() => setSetupMode('daemon')}
                      >
                        Realtime
                      </Button>
                      <Button
                        variant={setupMode === 'cron' ? 'default' : 'outline'}
                        size="xs"
                        onClick={() => setSetupMode('cron')}
                      >
                        Cron
                      </Button>
                    </div>
                  </div>
                  {setupMode === 'daemon' && (
                    <p className="text-xs text-muted-foreground">systemd daemon — 2s streaming, real-time metrics. Requires Node.js 18+.</p>
                  )}
                  {setupMode === 'cron' && (
                    <p className="text-xs text-muted-foreground">Cron — 1-min interval, no streaming. Simple but slower.</p>
                  )}
                </div>
                {activeInstructions && (
                  <div className="space-y-1.5">
                    <p className="label-sm">Setup Instructions</p>
                    <pre className="overflow-x-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-xs text-foreground whitespace-pre-wrap break-all">{activeInstructions}</pre>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => copyToClipboard(activeInstructions, 'instructions')}>
                      {copied.has('instructions') ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy All
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {servers.map((server) => {
          const cfg = statusConfig[server.status] || { variant: 'secondary' as const, label: server.status }
          const isSaved = saved.has(server.id)
          const isDeleting = deleting === server.id
          return (
            <Card key={server.id} size="sm">
              <CardContent>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-sm font-medium text-foreground">{server.server_name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(server.server_name, server.id)}
                      disabled={isDeleting}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="mb-3 font-mono text-sm text-muted-foreground">IP: {server.ip_address || '\u2014'}</p>
                <div className="space-y-2">
                  <Textarea
                    value={editNote[server.id] || ''}
                    onChange={(e) => {
                      setEditNote((prev) => ({ ...prev, [server.id]: e.target.value }))
                      setSaved(prev => { const n = new Set(prev); n.delete(server.id); return n })
                    }}
                    placeholder="Add override note..."
                    rows={2}
                    className="font-mono"
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdate(server.id)}
                      disabled={savingId === server.id}
                    >
                      {savingId === server.id ? 'Saving...' : 'Save'}
                    </Button>
                    {isSaved && <span className="text-sm text-muted-foreground">Saved</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {servers.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No servers found. Click &quot;Add Server&quot; to get started.</p>
        )}
      </div>
    </div>
  )
}