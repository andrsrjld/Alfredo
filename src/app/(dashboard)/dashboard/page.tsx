'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import RealtimeServerStatus from '@/components/realtime/RealtimeServerStatus'
import RealtimeProjectStatus from '@/components/realtime/RealtimeProjectStatus'
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card'
import { Monitor, Server, AlertTriangle, CheckCircle } from 'lucide-react'

type Stats = {
  totalServers: number
  online: number
  offline: number
  totalProjects: number
  success: number
  failed: number
  running: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalServers: 0, online: 0, offline: 0,
    totalProjects: 0, success: 0, failed: 0, running: 0,
  })

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [servers, projects] = await Promise.all([
        supabase.from('server_status').select('status'),
        supabase.from('project_status').select('status'),
      ])
      setStats({
        totalServers: servers.data?.length ?? 0,
        online: servers.data?.filter(s => s.status === 'online').length ?? 0,
        offline: servers.data?.filter(s => s.status === 'offline').length ?? 0,
        totalProjects: projects.data?.length ?? 0,
        success: projects.data?.filter(p => p.status === 'success').length ?? 0,
        failed: projects.data?.filter(p => p.status === 'failed').length ?? 0,
        running: projects.data?.filter(p => p.status === 'running').length ?? 0,
      })
    }
    load()
  }, [])

  const statCards = [
    { label: 'Total Servers', value: stats.totalServers, icon: Server, color: 'text-foreground' },
    { label: 'Online', value: stats.online, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Offline', value: stats.offline, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Pipelines OK', value: stats.success, icon: Monitor, color: 'text-emerald-400' },
    { label: 'Failed', value: stats.failed, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Running', value: stats.running, icon: Server, color: 'text-amber-400' },
  ]

  return (
    <div className="p-4 lg:p-6 xl:p-8 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} size="sm">
            <CardContent>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Servers</CardDescription>
        </CardHeader>
        <CardContent>
          <RealtimeServerStatus />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Pipelines</CardDescription>
        </CardHeader>
        <CardContent>
          <RealtimeProjectStatus />
        </CardContent>
      </Card>
    </div>
  )
}