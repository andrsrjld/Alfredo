import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { getGitLabPAT, fetchFailedJobLog } from '@/lib/gitlab'

export const dynamic = 'force-dynamic'

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

    if (!repoName) {
      return NextResponse.json({ error: 'Missing repo name' }, { status: 400 })
    }

    let errorDetail: string | null = null

    if (status === 'failed' && gitlabProjectId) {
      try {
        const pat = await getGitLabPAT()
        if (pat) {
          const pipelineId = String(payload.object_attributes?.id || '')
          if (pipelineId) {
            errorDetail = await fetchFailedJobLog(pat, gitlabProjectId, pipelineId)
          }
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
      last_updated: new Date().toISOString(),
    }

    if (status === 'failed' && errorDetail) {
      upsertData.error_detail = errorDetail
    } else if (status === 'success' || status === 'running') {
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