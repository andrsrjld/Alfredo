'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
  const supabase = createClient()

  useEffect(() => {
    async function fetchServers() {
      const { data } = await supabase.from('server_status').select('*').order('last_ping', { ascending: false })
      if (data) setServers(data)
    }
    fetchServers()

    const channel = supabase
      .channel('server_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_status' }, (payload) => {
        fetchServers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const statusColor: Record<string, string> = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    high_load: 'bg-yellow-500',
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {servers.map((server) => (
        <Card key={server.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{server.server_name}</CardTitle>
            <Badge className={statusColor[server.status] || 'bg-gray-500'}>{server.status}</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">IP: {server.ip_address || '-'}</p>
            <p className="text-xs text-muted-foreground">{server.notes || ''}</p>
            <p className="text-xs text-muted-foreground mt-2">Last ping: {new Date(server.last_ping).toLocaleString('id-ID')}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
