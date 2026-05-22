import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { getGitLabPAT, fetchFailedJobLog } from '@/lib/gitlab'

export const dynamic = 'force-dynamic'

function extractGitLabTimestamp(payload: Record<string, unknown>, status: string): string | null {
  const attrs = payload.object_attributes as Record<string, unknown> | undefined
  if (!attrs) return null

  if ((status === 'success' || status === 'failed' || status === 'canceled') && attrs.finished_at) {
    return String(attrs.finished_at)
  }
  if (attrs.created_at) {
    return String(attrs.created_at)
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
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

    if (eventTime) {
      const { data: existing } = await supabase
        .from('project_status')
        .select('gitlab_event_time, pipeline_id')
        .eq('repo_name', repoName)
        .maybeSingle()

      if (existing?.gitlab_event_time) {
        const existingTime = new Date(existing.gitlab_event_time).getTime()
        const incomingTime = new Date(eventTime).getTime()

        if (incomingTime <= existingTime) {
          console.log(`[GitLab webhook] Stale event for ${repoName}: incoming=${eventTime} <= existing=${existing.gitlab_event_time}, skipping`)
          return NextResponse.json({ ok: true, ignored: 'stale_event' })
        }
      }
    }

    let errorDetail: string | null = null

    if (status === 'failed' && gitlabProjectId && pipelineId) {
      try {
        const pat = await getGitLabPAT()
        if (pat) {
          errorDetail = await fetchFailedJobLog(pat, gitlabProjectId, pipelineId)
        }
      } catch (err) {
        console.error('[GitLab webhook] Failed to fetch job log:', err)
      }
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

    if (status === 'failed' && errorDetail) {
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