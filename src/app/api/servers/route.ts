import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomBytes } from 'crypto'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('server_status')
      .select('id, server_name, ip_address, status, notes, last_ping')
      .order('last_ping', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    }
    return NextResponse.json(data, noStore)
  } catch (err) {
    console.error('[Servers GET]', err)
    return NextResponse.json({ error: 'Failed to fetch servers' }, { status: 500, ...noStore })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { server_name, ip_address } = body as { server_name: string; ip_address?: string }

    if (!server_name || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(server_name)) {
      return NextResponse.json({ error: 'Invalid server_name. Use alphanumeric, dots, hyphens, underscores.' }, { status: 400, ...noStore })
    }

    const ping_secret = randomBytes(24).toString('hex')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alfredo-pi.vercel.app'

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('server_status')
      .insert({
        server_name,
        ip_address: ip_address || null,
        status: 'offline',
        ping_secret,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Server name already exists.' }, { status: 409, ...noStore })
      }
      return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    }

    const webhookUrl = `${baseUrl}/api/server-ping?secret=${ping_secret}`
    const scriptUrl = `${baseUrl}/api/scripts/alfredo-ping.sh?secret=${ping_secret}`
    const crontab = `* * * * * /usr/local/bin/alfredo-ping.sh >> /var/log/alfredo-ping.log 2>&1`
    const instructions = [
      `# 1. Download the ping script (secret pre-filled):`,
      `curl -sL "${scriptUrl}" -o /usr/local/bin/alfredo-ping.sh && chmod +x /usr/local/bin/alfredo-ping.sh`,
      `# 2. Add to crontab (runs every minute):`,
      `(crontab -l 2>/dev/null; echo "${crontab}") | crontab -`,
    ].join('\n')

    return NextResponse.json({ server: data, crontab, instructions, ping_url: webhookUrl, ping_secret }, { status: 201, ...noStore })
  } catch (err) {
    console.error('[Servers POST]', err)
    return NextResponse.json({ error: 'Failed to add server' }, { status: 500, ...noStore })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const server_name = searchParams.get('server_name')

    if (!server_name) {
      return NextResponse.json({ error: 'server_name required' }, { status: 400, ...noStore })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('server_status')
      .delete()
      .eq('server_name', server_name)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    }
    return NextResponse.json({ ok: true }, noStore)
  } catch (err) {
    console.error('[Servers DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete server' }, { status: 500, ...noStore })
  }
}