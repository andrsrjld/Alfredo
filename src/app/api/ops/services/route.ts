import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireDashboardUser } from '@/lib/api-guards'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDashboardUser('Ops services GET')
    if (!auth.ok) return auth.response
    const serverName = request.nextUrl.searchParams.get('server_name')
    if (!serverName) return NextResponse.json({ error: 'server_name required' }, { status: 400, ...noStore })
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('server_services')
      .select('*')
      .eq('server_name', serverName)
      .order('service_name', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    return NextResponse.json({ services: data || [] }, noStore)
  } catch (err) {
    console.error('[Ops services GET]', err)
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500, ...noStore })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireDashboardUser('Ops services PATCH')
    if (!auth.ok) return auth.response
    const body = await request.json()
    const { id, is_allowed } = body as { id?: string; is_allowed?: boolean }
    if (!id || typeof is_allowed !== 'boolean') {
      return NextResponse.json({ error: 'id and is_allowed required' }, { status: 400, ...noStore })
    }
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('server_services')
      .update({ is_allowed })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    return NextResponse.json({ service: data }, noStore)
  } catch (err) {
    console.error('[Ops services PATCH]', err)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500, ...noStore })
  }
}
