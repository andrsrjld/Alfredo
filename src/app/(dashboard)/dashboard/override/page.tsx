'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Server = {
  id: string
  server_name: string
  ip_address: string | null
  status: string
  notes: string | null
  last_ping: string
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

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-[1280px]">
      <div className="mb-2">
        <p className="text-xs text-muted-foreground/60">Manually add notes to override server status context</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {servers.map((server) => {
          const cfg = statusConfig[server.status] || { dot: 'bg-muted-foreground', label: 'text-muted-foreground' }
          const isSaved = saved.has(server.id)
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
                <span className={`label-sm shrink-0 ${cfg.label}`}>{server.status}</span>
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
          <p className="text-xs text-muted-foreground col-span-full py-8 text-center">No servers found.</p>
        )}
      </div>
    </div>
  )
}