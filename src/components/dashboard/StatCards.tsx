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
  pipelineFilter?: string | null
  onPipelineFilterChange?: (filter: string | null) => void
}

export default function StatCards({ stats, pipelineFilter, onPipelineFilterChange }: StatCardsProps) {
  const otherPipelines = Math.max(0, stats.totalProjects - stats.success - stats.failed - stats.running)
  const serverData = [
    { value: stats.online, colorClass: 'text-emerald-400', label: 'Online', key: 'online' },
    { value: stats.offline, colorClass: 'text-red-400', label: 'Offline', key: 'offline' },
  ]

  const pipelineData = [
    { value: stats.success, colorClass: 'text-emerald-400', label: 'Success', key: 'success' },
    { value: stats.failed, colorClass: 'text-red-400', label: 'Failed', key: 'failed' },
    { value: stats.running, colorClass: 'text-amber-400', label: 'Running', key: 'running' },
    { value: otherPipelines, colorClass: 'text-muted-foreground', label: 'Other', key: 'other' },
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
            className="mx-auto w-full"
            centerLabel={String(stats.online)}
            centerSubLabel="online servers"
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
            className="mx-auto w-full"
            centerLabel={String(stats.success)}
            centerSubLabel="successful pipelines"
            activeKey={pipelineFilter}
            onSelect={onPipelineFilterChange}
          />
        </CardContent>
      </Card>
    </div>
  )
}
