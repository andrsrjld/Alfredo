import { createAdminClient } from './supabase/admin'

interface SearchResult {
  type: 'project' | 'server' | 'container'
  data: Record<string, string | null | undefined>
  score: number
}

function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'status', 'server', 'project', 'container', 'docker', 'apa', 'kabar', 'bagaimana', 'gimana',
    'tolong', 'cek', 'check', 'cek', 'lihat', 'info', 'informasi', 'tentang',
    'dari', 'yang', 'di', 'ke', 'pada', 'untuk', 'dengan', 'adalah', 'itu',
    'ini', 'sudah', 'belum', 'kah', 'sih', 'dong', 'deh', 'nah', 'oh',
    'image', 'images', 'app', 'application', 'service', 'pod',
  ])
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\-_.]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w))
}

export async function smartSearch(query: string): Promise<SearchResult[]> {
  const supabase = createAdminClient()
  const keywords = extractKeywords(query)

  if (keywords.length === 0) return []

  const results: SearchResult[] = []
  const seen = new Set<string>()

  for (const keyword of keywords) {
    const [projectRes, serverRes, containerRes] = await Promise.all([
      supabase
        .from('project_status')
        .select('*')
        .or(`repo_name.ilike.%${keyword}%,project_group.ilike.%${keyword}%`)
        .limit(10),
      supabase
        .from('server_status')
        .select('*')
        .or(`server_name.ilike.%${keyword}%,ip_address.ilike.%${keyword}%`)
        .limit(10),
      supabase
        .from('container_status')
        .select('*')
        .or(`container_name.ilike.%${keyword}%,image.ilike.%${keyword}%`)
        .limit(10),
    ])

    if (projectRes.data) {
      for (const row of projectRes.data) {
        const key = `project:${row.repo_name}:${row.project_group || ''}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({ type: 'project', data: row, score: 1.0 })
        }
      }
    }

    if (serverRes.data) {
      for (const row of serverRes.data) {
        const key = `server:${row.server_name}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({ type: 'server', data: row, score: 1.0 })
        }
      }
    }

    if (containerRes.data) {
      for (const row of containerRes.data) {
        const key = `container:${row.server_name}:${row.container_name}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({ type: 'container', data: row, score: 1.0 })
        }
      }
    }
  }

  return results
}

export function formatSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return ''

  const lines: string[] = []
  for (const r of results) {
    if (r.type === 'project') {
      let line = `- Project: ${r.data.repo_name} | Group: ${r.data.project_group || '-'} | Branch: ${r.data.branch || '-'} | Status: ${r.data.status || '-'} | Commit: ${(r.data.commit_msg || '').slice(0, 80)}`
      if (r.data.error_detail) {
        line += ` | Error: ${(r.data.error_detail as string).slice(-500)}`
      }
      lines.push(line)
    } else if (r.type === 'container') {
      let line = `- Container: ${r.data.container_name} | Server: ${r.data.server_name} | Image: ${r.data.image || '-'} | Status: ${r.data.status || '-'}`
      if (r.data.uptime) line += ` | Uptime: ${r.data.uptime}`
      if (r.data.ports) line += ` | Ports: ${r.data.ports}`
      if (r.data.error_log) line += ` | Error: ${(r.data.error_log as string).slice(-500)}`
      lines.push(line)
    } else {
      let line = `- Server: ${r.data.server_name} | IP: ${r.data.ip_address || '-'} | Status: ${r.data.status || '-'} | Notes: ${r.data.notes || '-'} | Last Ping: ${r.data.last_ping || '-'}`
      if (r.data.cpu_usage !== null && r.data.cpu_usage !== undefined) line += ` | CPU: ${r.data.cpu_usage}%`
      if (r.data.memory_usage !== null && r.data.memory_usage !== undefined) line += ` | Memory: ${r.data.memory_usage}%`
      if (r.data.disk_usage !== null && r.data.disk_usage !== undefined) line += ` | Disk: ${r.data.disk_usage}%`
      if (r.data.uptime_hours !== null && r.data.uptime_hours !== undefined) line += ` | Uptime: ${Number(r.data.uptime_hours).toFixed(1)}h`
      lines.push(line)
    }
  }
  return lines.join('\n')
}