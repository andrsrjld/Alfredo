import { createAdminClient } from './supabase/admin'
import { decrypt } from './encryption'

const GITLAB_API = 'https://gitlab.com/api/v4'
const MAX_LOG_CHARS = 2000

export async function getGitLabPAT(): Promise<string | null> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_config')
      .single()

    if (error || !data) return null

    const raw = data.value as Record<string, unknown>
    const encryptedPat = raw.gitlab_pat as string | undefined
    if (!encryptedPat) return null

    try {
      return decrypt(encryptedPat)
    } catch {
      return encryptedPat
    }
  } catch {
    return null
  }
}

export async function fetchFailedJobLog(
  pat: string,
  projectId: string,
  pipelineId: string
): Promise<string | null> {
  try {
    const jobsRes = await fetch(
      `${GITLAB_API}/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}/jobs?status=failed&per_page=5`,
      {
        headers: { 'PRIVATE-TOKEN': pat },
      }
    )

    if (!jobsRes.ok) return null

    const jobs = await jobsRes.json() as Array<{ id: number; name: string; status: string }>
    if (!jobs.length) return null

    const failedJob = jobs[0]

    const traceRes = await fetch(
      `${GITLAB_API}/projects/${encodeURIComponent(projectId)}/jobs/${failedJob.id}/trace`,
      {
        headers: { 'PRIVATE-TOKEN': pat },
      }
    )

    if (!traceRes.ok) return null

    const trace = await traceRes.text()
    if (trace.length > MAX_LOG_CHARS) {
      return '...' + trace.slice(-MAX_LOG_CHARS)
    }
    return trace
  } catch (err) {
    console.error('[GitLab] fetchFailedJobLog error:', err)
    return null
  }
}