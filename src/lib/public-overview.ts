import { createAdminClient } from '@/lib/supabase/admin'
import type { ServerRecord } from '@/lib/servers'

export type PublicProject = {
  id: string
  repo_name: string
  project_group: string | null
  branch: string | null
  status: string
  last_updated: string
}

export type PublicServer = Pick<
  ServerRecord,
  'id' | 'server_name' | 'ip_address' | 'status' | 'cpu_usage' | 'memory_usage' | 'disk_usage' | 'last_ping'
>

export type PublicOverviewData = {
  servers: PublicServer[]
  projects: PublicProject[]
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

export async function getPublicOverviewData(): Promise<PublicOverviewData> {
  const supabase = createAdminClient()
  const [servers, projects] = await Promise.all([
    supabase
      .from('server_status')
      .select('id, server_name, ip_address, status, cpu_usage, memory_usage, disk_usage, last_ping')
      .order('server_name', { ascending: true }),
    supabase
      .from('project_status')
      .select('id, repo_name, project_group, branch, status, last_updated')
      .order('last_updated', { ascending: false }),
  ])

  if (servers.error) {
    throw new Error(`Failed to load servers: ${servers.error.message}`)
  }
  if (projects.error) {
    throw new Error(`Failed to load projects: ${projects.error.message}`)
  }

  const serverData = (servers.data || []) as PublicServer[]
  const projectData = (projects.data || []) as PublicProject[]

  return {
    servers: serverData,
    projects: projectData.slice(0, 10),
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
