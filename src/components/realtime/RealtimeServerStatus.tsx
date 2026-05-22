'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Server = {
  id: string
  server_name: string
  ip_address: string | null
  status: string
  notes: string | null
  last_ping: string
}

const SERVER_PAGE_SIZE = 10

const statusConfig: Record<string, { variant: 'default' | 'destructive' | 'secondary'; label: string }> = {
  online: { variant: 'default', label: 'online' },
  offline: { variant: 'destructive', label: 'offline' },
  high_load: { variant: 'secondary', label: 'high_load' },
}

export default function RealtimeServerStatus() {
  const [servers, setServers] = useState<Server[]>([])
  const [showCount, setShowCount] = useState(SERVER_PAGE_SIZE)

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

  function formatWIB(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const visible = servers.slice(0, showCount)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {visible.map((server) => {
          const cfg = statusConfig[server.status] || { variant: 'secondary' as const, label: server.status }
          return (
            <Card key={server.id} size="sm">
              <CardContent>
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span className="font-mono text-[11px] text-foreground truncate min-w-0">{server.server_name}</span>
                  <Badge variant={cfg.variant} className="text-[10px] shrink-0">{cfg.label}</Badge>
                </div>
                <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-muted-foreground/50">IP</span>
                    <span className="font-mono truncate ml-2">{server.ip_address || '\u2014'}</span>
                  </div>
                  {server.notes && (
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-muted-foreground/50">Note</span>
                      <span className="truncate ml-2 max-w-[120px]">{server.notes}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-muted-foreground/50">Ping</span>
                    <span className="font-mono" title={formatWIB(server.last_ping)}>{timeAgo(server.last_ping)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {servers.length === 0 && (
          <p className="text-xs text-muted-foreground col-span-full py-6 text-center">No servers reporting.</p>
        )}
      </div>
      {showCount < servers.length && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setShowCount(c => c + SERVER_PAGE_SIZE)}>
            Load more ({servers.length - showCount} remaining)
          </Button>
        </div>
      )}
    </div>
  )
}