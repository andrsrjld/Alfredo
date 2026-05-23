'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  type ServerRecord,
  hasReportedMetrics,
  isStale,
  statusConfig,
  timeAgo,
  formatWIB,
} from '@/lib/servers'
import { Terminal, Trash2 } from 'lucide-react'

type ServerCardProps = {
  server: ServerRecord
  variant?: 'compact' | 'default'
  onClick?: () => void
  adminActions?: {
    onSetup?: () => void
    onDelete?: () => void
    deleting?: boolean
  }
}

export default function ServerCard({ server, variant = 'default', onClick, adminActions }: ServerCardProps) {
  const stale = isStale(server)
  const cfg = stale
    ? { variant: 'destructive' as const, label: 'Offline' }
    : (statusConfig[server.status] || { variant: 'secondary' as const, label: server.status })
  const hasMetrics = !stale && hasReportedMetrics(server)
  const showLastPing = stale && hasReportedMetrics(server)
  const isCompact = variant === 'compact'

  return (
    <Card
      size="sm"
      className={cn('h-full', onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      <CardContent>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={cn('truncate font-mono font-medium text-foreground', isCompact ? 'text-xs' : 'text-sm')}>
            {server.server_name}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
            {adminActions && (
              <>
                {adminActions.onSetup && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); adminActions.onSetup?.() }}
                  >
                    <Terminal className="h-3 w-3" />
                  </Button>
                )}
                {adminActions.onDelete && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={adminActions.deleting}
                    onClick={(e) => { e.stopPropagation(); adminActions.onDelete?.() }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        <div className={cn('flex flex-col text-muted-foreground', isCompact ? 'text-xs gap-1' : 'text-sm gap-1.5')}>
          <div className="flex items-center justify-between">
            <span>IP</span>
            <span className="ml-2 truncate font-mono">{server.ip_address || '\u2014'}</span>
          </div>
          {hasMetrics && (
            <div className="flex items-center justify-between gap-1">
              <span>Load</span>
              <div className="flex items-center gap-1 font-mono text-xs">
                {server.cpu_usage !== null && (
                  <span className={server.cpu_usage >= 80 ? 'text-amber-500' : 'text-emerald-500'}>
                    C:{server.cpu_usage.toFixed(1)}%
                  </span>
                )}
                {server.memory_usage !== null && (
                  <span className={server.memory_usage >= 80 ? 'text-amber-500' : 'text-emerald-500'}>
                    M:{server.memory_usage.toFixed(1)}%
                  </span>
                )}
                {server.disk_usage !== null && (
                  <span className={server.disk_usage >= 80 ? 'text-amber-500' : 'text-emerald-500'}>
                    D:{server.disk_usage.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          )}
          {showLastPing && (
            <div className="flex items-center justify-between gap-1">
              <span>Last seen</span>
              <span className="font-mono text-xs" title={formatWIB(server.last_ping)}>{timeAgo(server.last_ping)}</span>
            </div>
          )}
          {!stale && (
            <div className="flex items-center justify-between">
              <span>Ping</span>
              <span className="font-mono" title={formatWIB(server.last_ping)}>{timeAgo(server.last_ping)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}