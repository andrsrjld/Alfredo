import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { getGitLabPAT, fetchFailedJobLog } from '@/lib/gitlab'
import { requireSharedWebhookSecret } from '@/lib/api-guards'

export const dynamic = 'force-dynamic'

const TERMINAL_STATES = ['success', 'failed', 'canceled']

function extractGitLabTimestamp(payload: Record<string, unknown>, status: string): string | null {
  const attrs = payload.object_attributes as Record<string, unknown> | undefined
  if (!attrs) return null

  if (TERMINAL_STATES.includes(status) && attrs.finished_at) {
    return String(attrs.finished_at)
  }
  if (attrs.updated_at) {
    return String(attrs.updated_at)
  }
  if (attrs.created_at) {
    return String(attrs.created_at)
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const unauthorized = requireSharedWebhookSecret(request, 'GitLab webhook')
    if (unauthorized) return unauthorized

    const token = request.headers.get('x-gitlab-token')
    if (token !== process.env.GITLAB_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json()

    if (payload.object_kind !== 'pipeline') {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const supabase = createAdminClient()

    const repoName = payload.project?.name
    const fullPath = payload.project?.path_with_namespace || ''
    const group = fullPath.includes('/')
      ? fullPath.substring(0, fullPath.lastIndexOf('/'))
      : (payload.project?.namespace || '')
    const branch = payload.object_attributes?.ref
    const status = payload.object_attributes?.status
    const commitMsg = payload.commit?.message || payload.object_attributes?.commit?.message || ''
    const gitlabProjectId = payload.project?.id ? String(payload.project.id) : null
    const pipelineId = payload.object_attributes?.id ? String(payload.object_attributes.id) : null
    const eventTime = extractGitLabTimestamp(payload, status)

    if (!repoName) {
      return NextResponse.json({ error: 'Missing repo name' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('project_status')
      .select('status, gitlab_event_time, pipeline_id')
      .eq('repo_name', repoName)
      .maybeSingle()

    if (existing) {
      if (eventTime && existing.gitlab_event_time) {
        const incomingTime = new Date(eventTime).getTime()
        const existingTime = new Date(existing.gitlab_event_time).getTime()
        if (incomingTime < existingTime) {
          console.log(`[GitLab webhook] Stale event for ${repoName}: incoming=${eventTime} < existing=${existing.gitlab_event_time}, skipping`)
          return NextResponse.json({ ok: true, ignored: 'stale_event' })
        }
      }

      if (TERMINAL_STATES.includes(existing.status) && !TERMINAL_STATES.includes(status)) {
        const samePipeline = pipelineId && existing.pipeline_id === pipelineId
        if (samePipeline) {
          console.log(`[GitLab webhook] Skipping ${status} for ${repoName}: pipeline ${pipelineId} is already ${existing.status}`)
          return NextResponse.json({ ok: true, ignored: 'terminal_state_unchanged' })
        }
      }
    }

    let errorDetail: string | null = null

    if (status === 'failed' && gitlabProjectId && pipelineId) {
      try {
        const pat = await getGitLabPAT()
        if (pat) {
          errorDetail = await fetchFailedJobLog(pat, gitlabProjectId, pipelineId)
          console.log(`[GitLab webhook] Fetched error detail for ${repoName}: ${errorDetail ? errorDetail.length + ' chars' : 'null'}`)
        } else {
          console.warn(`[GitLab webhook] No GitLab PAT configured, cannot fetch error detail for ${repoName}`)
          errorDetail = 'Pipeline failed. GitLab PAT not configured — unable to fetch error details.'
        }
      } catch (err) {
        console.error('[GitLab webhook] Failed to fetch job log:', err)
        errorDetail = `Pipeline failed. Error fetching job log: ${err instanceof Error ? err.message : String(err)}`
      }
    } else if (status === 'failed') {
      console.warn(`[GitLab webhook] Pipeline failed for ${repoName} but missing gitlabProjectId or pipelineId — cannot fetch error detail`)
      errorDetail = 'Pipeline failed. Unable to fetch error details (missing project or pipeline ID).'
    }

    const upsertData: Record<string, unknown> = {
      repo_name: repoName,
      project_group: group,
      branch,
      status,
      commit_msg: commitMsg,
      gitlab_project_id: gitlabProjectId,
      pipeline_id: pipelineId,
      gitlab_event_time: eventTime,
      last_updated: eventTime || new Date().toISOString(),
    }

    if (status === 'failed') {
      upsertData.error_detail = errorDetail
    } else if (status === 'success') {
      upsertData.error_detail = null
    }

    const { error } = await supabase
      .from('project_status')
      .upsert(upsertData, { onConflict: 'repo_name' })

    if (error) {
      console.error('GitLab webhook upsert error:', error)
      return NextResponse.json({ error: 'Database error', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('GitLab webhook error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
