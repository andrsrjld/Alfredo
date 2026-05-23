'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import RealtimeServerStatus from '@/components/realtime/RealtimeServerStatus'
import RealtimeProjectStatus from '@/components/realtime/RealtimeProjectStatus'
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card'
import { StatCards } from '@/components/dashboard/StatCards'

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

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 lg:p-6 xl:p-8">
      <StatCards stats={stats} />

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
