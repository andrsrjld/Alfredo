'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Server, Monitor } from 'lucide-react'
import { DonutChart } from './DonutChart'

interface StatCardsProps {
  stats: {
    totalServers: number
    online: number
    offline: number
    totalProjects: number
    success: number
    failed: number
    running: number
  }
}

export default function StatCards({ stats }: StatCardsProps) {
  const serverData = [
    { value: stats.online, colorClass: 'text-emerald-400', label: 'Online' },
    { value: stats.offline, colorClass: 'text-red-400', label: 'Offline' },
  ]

  const pipelineData = [
    { value: stats.success, colorClass: 'text-emerald-400', label: 'Success' },
    { value: stats.failed, colorClass: 'text-red-400', label: 'Failed' },
    { value: stats.running, colorClass: 'text-amber-400', label: 'Running' },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardDescription>Servers</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stats.totalServers}</CardTitle>
            </div>
            <div className="flex size-9 items-center justify-center rounded-md border bg-background">
              <Server className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <DonutChart
            data={serverData}
            size={144}
            strokeWidth={16}
            className="mx-auto w-full max-w-[360px] justify-center gap-7 lg:max-w-[420px] lg:gap-9"
            chartClassName="size-28 md:size-32 lg:size-36"
            legendClassName="w-32 md:w-40"
            centerLabel={String(stats.online)}
            centerSubLabel={stats.totalServers > 0 ? `${Math.round((stats.online / stats.totalServers) * 100)}%` : '0%'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardDescription>Pipelines</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stats.totalProjects}</CardTitle>
            </div>
            <div className="flex size-9 items-center justify-center rounded-md border bg-background">
              <Monitor className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <DonutChart
            data={pipelineData}
            size={144}
            strokeWidth={16}
            className="mx-auto w-full max-w-[360px] justify-center gap-7 lg:max-w-[420px] lg:gap-9"
            chartClassName="size-28 md:size-32 lg:size-36"
            legendClassName="w-32 md:w-40"
            centerLabel={String(stats.success)}
            centerSubLabel={stats.totalProjects > 0 ? `${Math.round((stats.success / stats.totalProjects) * 100)}%` : '0%'}
          />
        </CardContent>
      </Card>
    </div>
  )
}
