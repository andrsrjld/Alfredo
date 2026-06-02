import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireDashboardUser } from '@/lib/api-guards'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDashboardUser('Ops history GET')
    if (!auth.ok) return auth.response
    const serverName = request.nextUrl.searchParams.get('server_name')
    if (!serverName) return NextResponse.json({ error: 'server_name required' }, { status: 400, ...noStore })
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('ops_commands')
      .select('*')
      .eq('server_name', serverName)
      .order('requested_at', { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    return NextResponse.json({ commands: data || [] }, noStore)
  } catch (err) {
    console.error('[Ops history GET]', err)
    return NextResponse.json({ error: 'Failed to fetch ops history' }, { status: 500, ...noStore })
  }
}
