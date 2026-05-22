import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const supabase = createAdminClient()
    let serverName: string | undefined

    if (body.ping_secret) {
      const { data: server } = await supabase
        .from('server_status')
        .select('server_name')
        .eq('ping_secret', body.ping_secret)
        .maybeSingle()

      if (!server) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
      }
      serverName = server.server_name
    } else if (body.secret && body.secret === process.env.SERVER_PING_SECRET) {
      serverName = body.server_name
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
    }

    const { status, ip_address } = body

    if (!serverName || !status) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400, ...noStore })
    }

    const { error } = await supabase
      .from('server_status')
      .upsert(
        {
          server_name: serverName,
          status,
          ip_address: ip_address || undefined,
          last_ping: new Date().toISOString(),
        },
        { onConflict: 'server_name' }
      )

    if (error) {
      console.error('Server ping upsert error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500, ...noStore })
    }

    return NextResponse.json({ ok: true }, noStore)
  } catch (err) {
    console.error('Server ping error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, ...noStore })
  }
}