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

export default function RealtimeServerStatus() {
  const [servers, setServers] = useState<Server[]>([])

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

  const statusStyles: Record<string, string> = {
    online: 'text-primary',
    offline: 'text-destructive',
    high_load: 'text-tertiary',
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">IP: {server.ip_address || '—'}</p>
            {server.notes && <p className="text-xs text-muted-foreground">{server.notes}</p>}
            <p className="text-xs text-muted-foreground">Last ping: {new Date(server.last_ping).toLocaleString('id-ID')}</p>
          </div>
        </div>
      ))}
      {servers.length === 0 && (
        <p className="text-sm text-muted-foreground">No servers found.</p>
      )}
    </div>
  )
}