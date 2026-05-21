import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

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
    const group = payload.project?.namespace
    const branch = payload.object_attributes?.ref
    const status = payload.object_attributes?.status
    const commitMsg = payload.commit?.message || payload.object_attributes?.commit?.message || ''

    if (!repoName) {
      return NextResponse.json({ error: 'Missing repo name' }, { status: 400 })
    }

    const { error } = await supabase
      .from('project_status')
      .upsert(
        {
          repo_name: repoName,
          project_group: group,
          branch,
          status,
          commit_msg: commitMsg,
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'repo_name' }
      )

    if (error) {
      console.error('GitLab webhook upsert error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('GitLab webhook error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
