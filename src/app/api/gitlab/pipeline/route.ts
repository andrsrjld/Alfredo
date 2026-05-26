import { NextRequest, NextResponse } from 'next/server'
import { getGitLabPAT } from '@/lib/gitlab'

export const dynamic = 'force-dynamic'

const noStore = {
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  },
}

type GitLabPipelineResponse = {
  web_url?: string
}

function redirectToFallback(fallback: string | null) {
  if (!fallback) {
    return NextResponse.json({ error: 'Pipeline URL not found' }, { status: 404, ...noStore })
  }
  return NextResponse.redirect(fallback)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  const pipelineId = searchParams.get('pipeline_id')
  const fallback = searchParams.get('fallback')

  if (!projectId || !pipelineId) {
    return redirectToFallback(fallback)
  }

  try {
    const pat = await getGitLabPAT()
    const headers: HeadersInit = pat ? { 'PRIVATE-TOKEN': pat } : {}
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/pipelines/${encodeURIComponent(pipelineId)}`,
      { headers, cache: 'no-store' }
    )

    if (!res.ok) {
      console.error(`[GitLab pipeline URL] Fetch failed: ${res.status} project=${projectId} pipeline=${pipelineId}`)
      return redirectToFallback(fallback)
    }

    const pipeline = await res.json() as GitLabPipelineResponse
    if (!pipeline.web_url) {
      return redirectToFallback(fallback)
    }

    return NextResponse.redirect(pipeline.web_url)
  } catch (err) {
    console.error('[GitLab pipeline URL] Failed to resolve pipeline web_url:', err)
    return redirectToFallback(fallback)
  }
}
