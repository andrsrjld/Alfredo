'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import RealtimeServerStatus from '@/components/realtime/RealtimeServerStatus'
import RealtimeProjectStatus from '@/components/realtime/RealtimeProjectStatus'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import StatCards from '@/components/dashboard/StatCards'

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
  const [pipelineFilter, setPipelineFilter] = useState<string | null>(null)
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
    const interval = setInterval(load, 2000)
    const serverChannel = supabase
      .channel('dashboard_stats_server_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_status' }, () => {
        load()
      })
      .subscribe()
    const projectChannel = supabase
      .channel('dashboard_stats_project_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_status' }, () => {
        load()
      })
      .subscribe()
    return () => {
      clearInterval(interval)
      supabase.removeChannel(serverChannel)
      supabase.removeChannel(projectChannel)
    }
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold leading-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Live server health and GitLab pipeline status.</p>
      </div>

      <StatCards
        stats={stats}
        pipelineFilter={pipelineFilter}
        onPipelineFilterChange={setPipelineFilter}
      />

      <Card>
        <CardHeader>
          <CardTitle>Servers</CardTitle>
          <CardDescription>Realtime daemon reports from registered infrastructure.</CardDescription>
        </CardHeader>
        <CardContent>
          <RealtimeServerStatus />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipelines</CardTitle>
          <CardDescription>Latest GitLab pipeline events and failure details.</CardDescription>
        </CardHeader>
        <CardContent>
          <RealtimeProjectStatus statusFilter={pipelineFilter} />
        </CardContent>
      </Card>
    </div>
  )
}
