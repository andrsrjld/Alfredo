'use client'

import { Card, CardContent } from '@/components/ui/card'
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-foreground md:h-4 md:w-4" aria-hidden="true" />
              <span className="text-[10px] font-medium text-muted-foreground md:text-xs">Servers</span>
            </div>
            <span className="text-[10px] font-semibold text-foreground md:text-xs">{stats.totalServers}</span>
          </div>
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
        <CardContent className="p-4 md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-foreground md:h-4 md:w-4" aria-hidden="true" />
              <span className="text-[10px] font-medium text-muted-foreground md:text-xs">Pipelines</span>
            </div>
            <span className="text-[10px] font-semibold text-foreground md:text-xs">{stats.totalProjects}</span>
          </div>
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
