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

export function StatCards({ stats }: StatCardsProps) {
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
    <div className="grid grid-cols-2 gap-3">
      {/* Servers */}
      <Card>
        <CardContent className="p-3 md:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Server className="h-4 w-4 text-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Servers</span>
            </div>
            <span className="text-xs font-semibold text-foreground">{stats.totalServers}</span>
          </div>
          <DonutChart
            data={serverData}
            size={120}
            strokeWidth={14}
            centerLabel={String(stats.online)}
            centerSubLabel={stats.totalServers > 0 ? `${Math.round((stats.online / stats.totalServers) * 100)}%` : '0%'}
          />
        </CardContent>
      </Card>

      {/* Pipelines */}
      <Card>
        <CardContent className="p-3 md:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Monitor className="h-4 w-4 text-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Pipelines</span>
            </div>
            <span className="text-xs font-semibold text-foreground">{stats.totalProjects}</span>
          </div>
          <DonutChart
            data={pipelineData}
            size={120}
            strokeWidth={14}
            centerLabel={String(stats.success)}
            centerSubLabel={stats.totalProjects > 0 ? `${Math.round((stats.success / stats.totalProjects) * 100)}%` : '0%'}
          />
        </CardContent>
      </Card>
    </div>
  )
}
