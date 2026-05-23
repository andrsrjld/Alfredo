'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Copy, Check } from 'lucide-react'
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ServerCard from '@/components/servers/ServerCard'
import ServerDetailDialog from '@/components/servers/ServerDetailDialog'
import type { ServerRecord } from '@/lib/servers'
import { APP_URL } from '@/lib/servers'

export default function ServerPage() {
  const [servers, setServers] = useState<ServerRecord[]>([])
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedServer, setSelectedServer] = useState<ServerRecord | null>(null)
  const [openSetupOnSelect, setOpenSetupOnSelect] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function fetchServers() {
      const { data } = await supabase.from('server_status').select('*').order('last_ping', { ascending: false })
      if (data) setServers(data as ServerRecord[])
    }
    fetchServers()
    const interval = setInterval(fetchServers, 5000)
    return () => clearInterval(interval)
  }, [])

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
        setServers(prev => [data.server as ServerRecord, ...prev])
      }
      setAddName('')
      setAddIp('')
    } catch {
      setAddError('Network error')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(server: ServerRecord) {
    if (!confirm(`Delete server "${server.server_name}"?`)) return
    setDeletingId(server.id)
    try {
      const res = await fetch(`/api/servers?server_name=${encodeURIComponent(server.server_name)}`, { method: 'DELETE' })
      if (res.ok) {
        setServers(prev => prev.filter(s => s.id !== server.id))
        if (selectedServer?.id === server.id) setSelectedServer(null)
      }
    } finally {
      setDeletingId(null)
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(prev => { const n = new Set(prev); n.add(key); return n })
    setTimeout(() => setCopied(prev => { const n = new Set(prev); n.delete(key); return n }), 2000)
  }

  function handleServerUpdated(updated: ServerRecord) {
    setServers(prev => prev.map(s => (s.id === updated.id ? updated : s)))
    setSelectedServer(updated)
  }

  const activeInstructions = setupMode === 'daemon' ? daemonInstructions : cronInstructions

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 lg:p-6 xl:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Manage servers, notes, and agents.</p>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <p className="label-sm">Ping Secret</p>
                      <Button variant="outline" size="sm" className="h-7 w-full gap-1.5 text-xs" onClick={() => {
                        const secret = new URL(pingUrl, APP_URL).searchParams.get('secret')
                        if (secret) copyToClipboard(secret, 'secret')
                      }}>
                        {copied.has('secret') ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <p className="label-sm">Ping URL</p>
                      <Button variant="outline" size="sm" className="h-7 w-full gap-1.5 text-xs" onClick={() => copyToClipboard(pingUrl, 'url')}>
                        {copied.has('url') ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="label-sm">Setup Mode</p>
                    <Button variant={setupMode === 'daemon' ? 'default' : 'outline'} size="xs" onClick={() => setSetupMode('daemon')}>Realtime</Button>
                    <Button variant={setupMode === 'cron' ? 'default' : 'outline'} size="xs" onClick={() => setSetupMode('cron')}>Cron</Button>
                  </div>
                </div>
                {activeInstructions && (
                  <div className="space-y-1.5">
                    <p className="label-sm">Setup Instructions</p>
                    <pre className="overflow-x-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap break-all">{activeInstructions}</pre>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => copyToClipboard(activeInstructions, 'instructions')}>
                      {copied.has('instructions') ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy All
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {servers.map(server => (
          <ServerCard
            key={server.id}
            server={server}
            onClick={() => { setOpenSetupOnSelect(false); setSelectedServer(server) }}
            adminActions={{
              onSetup: () => { setOpenSetupOnSelect(true); setSelectedServer(server) },
              onDelete: () => handleDelete(server),
              deleting: deletingId === server.id,
            }}
          />
        ))}
        {servers.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No servers found. Click &quot;Add Server&quot; to get started.</p>
        )}
      </div>

      <ServerDetailDialog
        serverId={selectedServer?.id ?? null}
        initialServer={selectedServer}
        open={!!selectedServer}
        onOpenChange={(open) => { if (!open) { setSelectedServer(null); setOpenSetupOnSelect(false) } }}
        editable
        showAdminTools
        initialShowSetup={openSetupOnSelect}
        onServerUpdated={handleServerUpdated}
        onServerDeleted={() => {
          if (selectedServer) setServers(prev => prev.filter(s => s.id !== selectedServer.id))
          setSelectedServer(null)
        }}
      />
    </div>
  )
}
