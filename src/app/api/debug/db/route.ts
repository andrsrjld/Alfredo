import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const [pms, projects, servers] = await Promise.all([
      supabase.from('whitelisted_pms').select('*').limit(10),
      supabase.from('project_status').select('repo_name, status').limit(10),
      supabase.from('server_status').select('server_name, status').limit(10),
    ])

    return NextResponse.json({
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
      has_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      whitelisted_pms: pms.data,
      whitelisted_pms_error: pms.error?.message,
      project_count: projects.data?.length,
      server_count: servers.data?.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}