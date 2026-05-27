'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import StatCards from '@/components/dashboard/StatCards'
import { statusConfig, timeAgo } from '@/lib/servers'
import type { PublicOverviewData, PublicProject, PublicServer } from '@/lib/public-overview'

const projectStatusConfig: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'success' | 'warning'; label: string }> = {
  success: { variant: 'success', label: 'Success' },
  failed: { variant: 'destructive', label: 'Failed' },
  running: { variant: 'warning', label: 'Running' },
  canceled: { variant: 'secondary', label: 'Canceled' },
  pending: { variant: 'secondary', label: 'Pending' },
  skipped: { variant: 'secondary', label: 'Skipped' },
  manual: { variant: 'secondary', label: 'Manual' },
  created: { variant: 'secondary', label: 'Created' },
}

function formatWIBShort(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function publicServerStatus(server: PublicServer) {
  return statusConfig[server.status] || { variant: 'secondary' as const, label: server.status || 'Unknown' }
}

function ServerGrid({ servers }: { servers: PublicServer[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Servers</CardTitle>
        <CardDescription>Latest daemon reports from registered infrastructure.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {servers.map(server => {
            const cfg = publicServerStatus(server)
            return (
              <Card key={server.id} size="sm" className="bg-background/60">
                <CardContent>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-sm font-medium">{server.server_name}</span>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <span>IP</span>
                      <span className="truncate font-mono text-foreground/80">{server.ip_address || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Load</span>
                      <span className="truncate font-mono text-xs text-foreground/80">
                        C:{server.cpu_usage?.toFixed(1) ?? '-'}% M:{server.memory_usage?.toFixed(1) ?? '-'}% D:{server.disk_usage?.toFixed(1) ?? '-'}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Ping</span>
                      <span className="font-mono text-foreground/80">{timeAgo(server.last_ping)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {servers.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No servers reporting.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ProjectGrid({ projects }: { projects: PublicProject[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipelines</CardTitle>
        <CardDescription>Latest GitLab pipeline events.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {projects.map(project => {
            const cfg = projectStatusConfig[project.status] || { variant: 'secondary' as const, label: project.status }
            return (
              <Card key={project.id} size="sm" className="bg-background/60">
                <CardContent>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-sm font-medium">{project.repo_name}</span>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <span>Group</span>
                      <span className="truncate text-foreground/80">{project.project_group || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Branch</span>
                      <span className="truncate text-foreground/80">{project.branch || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Updated</span>
                      <span className="font-mono text-foreground/80">{formatWIBShort(project.last_updated)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {projects.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No projects found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function PublicOverview({ initialData }: { initialData: PublicOverviewData }) {
  const [overview, setOverview] = useState(initialData)

  useEffect(() => {
    let alive = true

    async function refreshOverview() {
      try {
        const res = await fetch('/api/public/overview', { cache: 'no-store' })
        if (!res.ok) return
        const next = await res.json() as PublicOverviewData
        if (alive) setOverview(next)
      } catch (err) {
        console.error('[PublicOverview] refresh failed:', err)
      }
    }

    const interval = setInterval(refreshOverview, 2000)
    return () => {
      alive = false
      clearInterval(interval)
    }
  }, [])

  return (
    <>
      <StatCards stats={overview.stats} />
      <ServerGrid servers={overview.servers} />
      <ProjectGrid projects={overview.projects} />
    </>
  )
}
