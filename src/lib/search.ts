import { createAdminClient } from './supabase/admin'

interface SearchResult {
  type: 'project' | 'server'
  data: Record<string, any>
  score: number
}

export async function smartSearch(keyword: string): Promise<SearchResult[]> {
  const supabase = createAdminClient()
  const term = keyword.trim()

  if (!term) return []

  const [projectRes, serverRes] = await Promise.all([
    supabase
      .from('project_status')
      .select('*')
      .or(`repo_name.ilike.%${term}%,project_group.ilike.%${term}%`)
      .limit(10),
    supabase
      .from('server_status')
      .select('*')
      .or(`server_name.ilike.%${term}%,ip_address.ilike.%${term}%`)
      .limit(10),
  ])

  const results: SearchResult[] = []

  if (projectRes.data) {
    for (const row of projectRes.data) {
      results.push({ type: 'project', data: row, score: 1.0 })
    }
  }

  if (serverRes.data) {
    for (const row of serverRes.data) {
      results.push({ type: 'server', data: row, score: 1.0 })
    }
  }

  return results
}

export function formatSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return ''

  const lines: string[] = []
  for (const r of results) {
    if (r.type === 'project') {
      lines.push(
        `- Project: ${r.data.repo_name} | Group: ${r.data.project_group || '-'} | Branch: ${r.data.branch || '-'} | Status: ${r.data.status || '-'} | Commit: ${(r.data.commit_msg || '').slice(0, 80)}`
      )
    } else {
      lines.push(
        `- Server: ${r.data.server_name} | IP: ${r.data.ip_address || '-'} | Status: ${r.data.status || '-'} | Notes: ${r.data.notes || '-'} | Last Ping: ${r.data.last_ping || '-'}`
      )
    }
  }
  return lines.join('\n')
}
