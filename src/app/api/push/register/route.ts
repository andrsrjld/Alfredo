import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireDashboardUser } from '@/lib/api-guards'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDashboardUser('Push register')
    if (!auth.ok) return auth.response
    const body = await request.json()
    const token = String(body.fcm_token || '').trim()
    const appVersion = body.app_version ? String(body.app_version) : null
    if (!token) return NextResponse.json({ error: 'fcm_token required' }, { status: 400, ...noStore })

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('push_devices')
      .upsert({
        user_id: auth.user.id,
        fcm_token: token,
        platform: 'android',
        app_version: appVersion,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'fcm_token' })
      .select('id,last_seen')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    return NextResponse.json({ ok: true, device: data }, noStore)
  } catch (err) {
    console.error('[Push register]', err)
    return NextResponse.json({ error: 'Failed to register push token' }, { status: 500, ...noStore })
  }
}
