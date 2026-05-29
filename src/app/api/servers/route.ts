import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomBytes } from 'crypto'
import { requireDashboardUser } from '@/lib/api-guards'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireDashboardUser('Servers GET')
    if (!auth.ok) return auth.response

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
    const auth = await requireDashboardUser('Servers POST')
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { server_name, ip_address } = body as { server_name: string; ip_address?: string }

    if (!server_name || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(server_name)) {
      return NextResponse.json({ error: 'Invalid server_name. Use alphanumeric, dots, hyphens, underscores.' }, { status: 400, ...noStore })
    }

    const ping_secret = randomBytes(24).toString('hex')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

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
    const daemonScriptUrl = `${baseUrl}/api/daemon?secret=${ping_secret}`
    const daemonServiceUrl = `${baseUrl}/api/daemon?type=service&secret=${ping_secret}`
    const pingScriptUrl = `${baseUrl}/api/scripts/alfredo-ping.sh?secret=${ping_secret}`
    const crontab = `* * * * * /usr/local/bin/alfredo-ping.sh >> /var/log/alfredo-ping.log 2>&1`

    const daemonInstructions = [
      `# ── Realtime Daemon (recommended) ──`,
      `# 1. Download daemon script (secrets embedded, bash only):`,
      `sudo curl -sL "${daemonScriptUrl}" -o /usr/local/bin/alfredo-daemon.sh && sudo chmod +x /usr/local/bin/alfredo-daemon.sh`,
      `# 2. Download systemd service unit:`,
      `sudo curl -sL "${daemonServiceUrl}" -o /etc/systemd/system/alfredo-daemon.service`,
      `# 3. Enable and start:`,
      `sudo systemctl daemon-reload && sudo systemctl enable --now alfredo-daemon`,
    ].join('\n')

    const cronInstructions = [
      `# ── Cron Fallback (1-min interval, no streaming) ──`,
      `# 1. Download ping script:`,
      `sudo curl -sL "${pingScriptUrl}" -o /usr/local/bin/alfredo-ping.sh && sudo chmod +x /usr/local/bin/alfredo-ping.sh`,
      `# 2. Add to crontab:`,
      `(crontab -l 2>/dev/null; echo "${crontab}") | crontab -`,
    ].join('\n')

    return NextResponse.json({
      server: data,
      ping_url: webhookUrl,
      ping_secret,
      daemon_script_url: daemonScriptUrl,
      daemon_service_url: daemonServiceUrl,
      daemon_instructions: daemonInstructions,
      cron_instructions: cronInstructions,
    }, { status: 201, ...noStore })
  } catch (err) {
    console.error('[Servers POST]', err)
    return NextResponse.json({ error: 'Failed to add server' }, { status: 500, ...noStore })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireDashboardUser('Servers PATCH')
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { id, server_name, ip_address, notes } = body as {
      id?: string
      server_name?: string
      ip_address?: string | null
      notes?: string | null
    }

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400, ...noStore })
    }

    if (server_name !== undefined && !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(server_name)) {
      return NextResponse.json({ error: 'Invalid server_name. Use alphanumeric, dots, hyphens, underscores.' }, { status: 400, ...noStore })
    }

    const supabase = createAdminClient()
    const updates: Record<string, unknown> = {}
    if (server_name !== undefined) updates.server_name = server_name
    if (ip_address !== undefined) updates.ip_address = ip_address || null
    if (notes !== undefined) updates.notes = notes || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400, ...noStore })
    }

    const { data, error } = await supabase
      .from('server_status')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Server name already exists.' }, { status: 409, ...noStore })
      }
      console.error('[Servers PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    }

    return NextResponse.json({ server: data }, noStore)
  } catch (err) {
    console.error('[Servers PATCH]', err)
    return NextResponse.json({ error: 'Failed to update server' }, { status: 500, ...noStore })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireDashboardUser('Servers DELETE')
    if (!auth.ok) return auth.response

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
