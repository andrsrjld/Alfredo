import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireDashboardUser } from '@/lib/api-guards'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDashboardUser('Push unregister')
    if (!auth.ok) return auth.response
    const body = await request.json()
    const token = String(body.fcm_token || '').trim()
    if (!token) return NextResponse.json({ error: 'fcm_token required' }, { status: 400, ...noStore })

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('push_devices')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('fcm_token', token)
    if (error) return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    return NextResponse.json({ ok: true }, noStore)
  } catch (err) {
    console.error('[Push unregister]', err)
    return NextResponse.json({ error: 'Failed to unregister push token' }, { status: 500, ...noStore })
  }
}
