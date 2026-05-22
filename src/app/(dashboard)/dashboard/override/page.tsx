'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Copy, Check, Trash2 } from 'lucide-react'

type Server = {
  id: string
  server_name: string
  ip_address: string | null
  status: string
  notes: string | null
  last_ping: string
  ping_secret?: string | null
}

const statusConfig: Record<string, { dot: string; label: string }> = {
  online: { dot: 'bg-primary', label: 'text-primary' },
  offline: { dot: 'bg-destructive', label: 'text-destructive' },
  high_load: { dot: 'bg-tertiary', label: 'text-tertiary' },
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
  const [crontab, setCrontab] = useState('')
  const [copied, setCopied] = useState(false)
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
    setCrontab('')
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
      if (data.crontab) {
        setCrontab(data.crontab)
      }
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

  function copyCrontab() {
    navigator.clipboard.writeText(crontab)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-[1280px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground/60">Manage servers &amp; override notes</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 font-mono text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Server
        </button>
      </div>

      {showAdd && (
        <div className="border border-border rounded-md bg-card p-4 space-y-3">
          <form onSubmit={handleAddServer} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="label-sm text-muted-foreground/60 mb-1.5 block">Server Name</label>
              <input
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="app-prod-01"
                required
                pattern="^[a-zA-Z0-9][a-zA-Z0-9._-]*$"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
              />
            </div>
            <div>
              <label className="label-sm text-muted-foreground/60 mb-1.5 block">IP Address (optional)</label>
              <input
                value={addIp}
                onChange={e => setAddIp(e.target.value)}
                placeholder="10.0.1.5"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={adding || !addName.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-sm font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50 shrink-0"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </form>
          {addError && <p className="text-xs text-destructive">{addError}</p>}
          {crontab && (
            <div className="space-y-2 pt-2">
              <p className="label-sm text-muted-foreground/60">Crontab — paste on your server:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted/50 border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground break-all select-all">
                  {crontab}
                </code>
                <button onClick={copyCrontab} className="shrink-0 p-2 hover:bg-muted/50 rounded-sm transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {servers.map((server) => {
          const cfg = statusConfig[server.status] || { dot: 'bg-muted-foreground', label: 'text-muted-foreground' }
          const isSaved = saved.has(server.id)
          const isDeleting = deleting === server.id
          return (
            <div
              key={server.id}
              className="border border-border rounded-md p-4 bg-card"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <span className="font-mono text-xs text-foreground truncate">{server.server_name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`label-sm ${cfg.label}`}>{server.status}</span>
                  <button
                    onClick={() => handleDelete(server.server_name, server.id)}
                    disabled={isDeleting}
                    className="p-1 hover:bg-destructive/10 rounded-sm transition-colors"
                    title="Delete server"
                  >
                    <Trash2 className={`h-3 w-3 ${isDeleting ? 'text-muted-foreground' : 'text-muted-foreground hover:text-destructive'}`} />
                  </button>
                </div>
              </div>
              <p className="font-mono text-xs text-muted-foreground mb-3">IP: {server.ip_address || '—'}</p>
              <div className="space-y-2">
                <textarea
                  value={editNote[server.id] || ''}
                  onChange={(e) => {
                    setEditNote((prev) => ({ ...prev, [server.id]: e.target.value }))
                    setSaved(prev => { const n = new Set(prev); n.delete(server.id); return n })
                  }}
                  placeholder="Add override note..."
                  rows={2}
                  className="w-full bg-background border border-border rounded-sm px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none resize-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleUpdate(server.id)}
                    disabled={savingId === server.id}
                    className="font-mono text-xs uppercase tracking-wider text-primary hover:text-primary/80 transition-colors disabled:text-muted-foreground"
                  >
                    {savingId === server.id ? 'Saving...' : 'Save'}
                  </button>
                  {isSaved && <span className="font-mono text-xs text-primary/60">Saved</span>}
                </div>
              </div>
            </div>
          )
        })}
        {servers.length === 0 && (
          <p className="text-xs text-muted-foreground col-span-full py-8 text-center">No servers found. Click &quot;Add Server&quot; to get started.</p>
        )}
      </div>
    </div>
  )
}