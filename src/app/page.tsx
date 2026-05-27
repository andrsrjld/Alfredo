import Link from 'next/link'
import { Activity, LockKeyhole } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import StatCards from '@/components/dashboard/StatCards'
import { statusConfig, timeAgo, type ServerRecord } from '@/lib/servers'

export const dynamic = 'force-dynamic'

type Project = {
  id: string
  repo_name: string
  project_group: string | null
  branch: string | null
  status: string
  last_updated: string
}

type PublicServer = Pick<
  ServerRecord,
  'id' | 'server_name' | 'ip_address' | 'status' | 'cpu_usage' | 'memory_usage' | 'disk_usage' | 'last_ping'
>

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
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function publicServerStatus(server: PublicServer) {
  return statusConfig[server.status] || { variant: 'secondary' as const, label: server.status || 'Unknown' }
}

async function getOverviewData() {
  const supabase = createAdminClient()
  const [servers, projects] = await Promise.all([
    supabase
      .from('server_status')
      .select('id, server_name, ip_address, status, cpu_usage, memory_usage, disk_usage, last_ping')
      .order('server_name', { ascending: true }),
    supabase
      .from('project_status')
      .select('id, repo_name, project_group, branch, status, last_updated')
      .order('last_updated', { ascending: false })
  ])

  const serverData = (servers.data || []) as PublicServer[]
  const projectData = (projects.data || []) as Project[]
  const visibleProjects = projectData.slice(0, 10)

  return {
    servers: serverData,
    projects: visibleProjects,
    stats: {
      totalServers: serverData.length,
      online: serverData.filter(server => server.status === 'online').length,
      offline: serverData.filter(server => server.status === 'offline').length,
      totalProjects: projectData.length,
      success: projectData.filter(project => project.status === 'success').length,
      failed: projectData.filter(project => project.status === 'failed').length,
      running: projectData.filter(project => project.status === 'running').length,
    },
  }
}

export default async function RootPage() {
  const { servers, projects, stats } = await getOverviewData()

  return (
    <main className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="size-4" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-none">Alfredo</span>
              <span className="text-xs text-muted-foreground">DevOps Companion</span>
            </div>
          </div>
          <Button render={<Link href="/login" />}>
            <LockKeyhole className="size-4" aria-hidden="true" />
            Sign in
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">Live server health and GitLab pipeline status.</p>
        </div>

        <StatCards stats={stats} />

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
      </div>
    </main>
  )
}
