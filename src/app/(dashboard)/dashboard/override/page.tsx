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

export default function OverridePage() {
  const [servers, setServers] = useState<Server[]>([])
  const [editNote, setEditNote] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

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
    const { error } = await supabase
      .from('server_status')
      .update({ notes: editNote[id] || null })
      .eq('id', id)
    if (error) {
      console.error('Failed to update note:', error)
    }
    setSavingId(null)
  }

  const statusStyles: Record<string, string> = {
    online: 'text-primary',
    offline: 'text-destructive',
    high_load: 'text-tertiary',
  }

  return (
    <div className="p-5 md:p-lg space-y-md">
      <p className="label-sm text-muted-foreground">Override Server Notes</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {servers.map((server) => (
          <div
            key={server.id}
            className="border border-border rounded-md p-4 bg-card"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-sm text-foreground">{server.server_name}</span>
              <span className={`label-sm ${statusStyles[server.status] || 'text-muted-foreground'}`}>
                {server.status}
              </span>
            </div>
            <p className="font-mono text-xs text-muted-foreground mb-3">IP: {server.ip_address || '—'}</p>
            <textarea
              value={editNote[server.id] || ''}
              onChange={(e) => setEditNote((prev) => ({ ...prev, [server.id]: e.target.value }))}
              placeholder="Add manual override note..."
              rows={2}
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none resize-none mb-3"
            />
            <button
              onClick={() => handleUpdate(server.id)}
              disabled={savingId === server.id}
              className="font-mono text-xs uppercase tracking-wider text-primary hover:text-primary/80 transition-colors disabled:text-muted-foreground"
            >
              {savingId === server.id ? 'Saving...' : 'Update Note'}
            </button>
          </div>
        ))}
        {servers.length === 0 && (
          <p className="text-xs text-muted-foreground">No servers found.</p>
        )}
      </div>
    </div>
  )
}