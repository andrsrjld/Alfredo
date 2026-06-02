import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { STALE_THRESHOLD_MS } from '@/lib/servers'
import { sendPushNotification, timeBucketKey } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  try {
    const supabase = createAdminClient()
    const staleSince = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()

    const { data, error } = await supabase
      .from('server_status')
      .update({ status: 'offline' })
      .eq('status', 'online')
      .lt('last_ping', staleSince)
      .select('server_name')

    if (error) {
      console.error('[cron/stale-check]', error)
      return NextResponse.json({ error: error.message }, {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const marked = data?.map((s) => s.server_name) ?? []
    if (marked.length > 0) {
      console.log(`[cron/stale-check] Marked offline: ${marked.join(', ')}`)
      await Promise.all(marked.map(serverName => sendPushNotification({
        eventType: 'server_offline',
        target: serverName,
        dedupeKey: timeBucketKey('server_offline', serverName, 15),
        title: 'Alfredo: Server offline',
        body: `${serverName} tidak mengirim ping dalam threshold monitoring.`,
      })))
    }

    return NextResponse.json({ marked_offline: marked }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[cron/stale-check]', err)
    return NextResponse.json({ error: 'Internal server error' }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
