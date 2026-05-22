import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const adminClient = createAdminClient()

    const [pms, projects, servers] = await Promise.all([
      adminClient.from('whitelisted_pms').select('*').limit(10),
      adminClient.from('project_status').select('repo_name, status').limit(10),
      adminClient.from('server_status').select('server_name, status').limit(10),
    ])

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    return NextResponse.json({
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      service_key_prefix: serviceKey.substring(0, 8) + '...' + serviceKey.substring(serviceKey.length - 4),
      anon_key_prefix: anonKey.substring(0, 8) + '...',
      keys_match: serviceKey !== anonKey,
      whitelisted_pms: pms.data,
      whitelisted_pms_error: pms.error,
      project_count: projects.data?.length,
      project_data: projects.data,
      server_count: servers.data?.length,
      server_data: servers.data,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}