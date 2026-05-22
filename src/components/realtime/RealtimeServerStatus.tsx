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

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  function formatWIB(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {servers.map((server) => {
        const cfg = statusConfig[server.status] || { dot: 'bg-muted-foreground', label: 'text-muted-foreground' }
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
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="font-mono text-muted-foreground/50">IP</span>
                <span className="font-mono">{server.ip_address || '—'}</span>
              </div>
              {server.notes && (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-muted-foreground/50">Note</span>
                  <span className="truncate max-w-[160px]">{server.notes}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="font-mono text-muted-foreground/50">Ping</span>
                <span className="font-mono" title={formatWIB(server.last_ping)}>{timeAgo(server.last_ping)}</span>
              </div>
            </div>
          </div>
        )
      })}
      {servers.length === 0 && (
        <p className="text-xs text-muted-foreground col-span-full py-8 text-center">No servers reporting.</p>
      )}
    </div>
  )
}