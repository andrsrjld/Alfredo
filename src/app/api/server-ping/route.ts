import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.secret !== process.env.SERVER_PING_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { server_name, status, ip_address } = body

    if (!server_name || !status) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('server_status')
      .upsert(
        {
          server_name,
          status,
          ip_address: ip_address || null,
          last_ping: new Date().toISOString(),
        },
        { onConflict: 'server_name' }
      )

    if (error) {
      console.error('Server ping upsert error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Server ping error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
