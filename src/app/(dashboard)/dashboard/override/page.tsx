'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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

export default function OverridePage() {
  const [servers, setServers] = useState<Server[]>([])
  const [editNote, setEditNote] = useState<Record<string, string>>({})

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
    const { error } = await supabase
      .from('server_status')
      .update({ notes: editNote[id] || null })
      .eq('id', id)
    if (!error) {
      alert('Updated')
    } else {
      alert('Failed: ' + error.message)
    }
  }

  const statusColor: Record<string, string> = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    high_load: 'bg-yellow-500',
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Override Server Notes</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {servers.map((server) => (
          <Card key={server.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{server.server_name}</CardTitle>
              <Badge className={statusColor[server.status] || 'bg-gray-500'}>{server.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">IP: {server.ip_address || '-'}</p>
              <Textarea
                value={editNote[server.id] || ''}
                onChange={(e) => setEditNote((prev) => ({ ...prev, [server.id]: e.target.value }))}
                placeholder="Add manual override note here..."
                rows={3}
              />
              <Button onClick={() => handleUpdate(server.id)} size="sm">Update Note</Button>
            </CardContent>
          </Card>
        ))}
        {servers.length === 0 && (
          <p className="text-muted-foreground">No servers found.</p>
        )}
      </div>
    </div>
  )
}
