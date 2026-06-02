import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireDashboardUser } from '@/lib/api-guards'
import { decrypt, encrypt } from '@/lib/encryption'
import { execSsh, type SshCredentials } from '@/lib/ssh'
import { APP_URL } from '@/lib/servers'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

export const dynamic = 'force-dynamic'

type SshAuthType = 'key' | 'password' | 'key_password'

type ServerSshRow = {
  id: string
  server_name: string
  ping_secret: string | null
  ssh_host: string | null
  ssh_port: number | null
  ssh_username: string | null
  ssh_auth_type: SshAuthType | null
  ssh_private_key_encrypted: string | null
  ssh_passphrase_encrypted: string | null
  ssh_password_encrypted: string | null
}

function metadata(row: ServerSshRow) {
  return {
    id: row.id,
    server_name: row.server_name,
    ssh_host: row.ssh_host,
    ssh_port: row.ssh_port || 22,
    ssh_username: row.ssh_username,
    ssh_auth_type: row.ssh_auth_type,
    has_private_key: !!row.ssh_private_key_encrypted,
    has_passphrase: !!row.ssh_passphrase_encrypted,
    has_password: !!row.ssh_password_encrypted,
  }
}

async function getServer(id: string): Promise<ServerSshRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('server_status')
    .select('id, server_name, ping_secret, ssh_host, ssh_port, ssh_username, ssh_auth_type, ssh_private_key_encrypted, ssh_passphrase_encrypted, ssh_password_encrypted')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as ServerSshRow | null
}

function credentialsFromRow(row: ServerSshRow): SshCredentials {
  if (!row.ssh_host || !row.ssh_username) {
    throw new Error('SSH host and username are required')
  }
  return {
    host: row.ssh_host,
    port: row.ssh_port || 22,
    username: row.ssh_username,
    privateKey: row.ssh_private_key_encrypted ? decrypt(row.ssh_private_key_encrypted) : null,
    passphrase: row.ssh_passphrase_encrypted ? decrypt(row.ssh_passphrase_encrypted) : null,
    password: row.ssh_password_encrypted ? decrypt(row.ssh_password_encrypted) : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDashboardUser('Servers SSH GET')
    if (!auth.ok) return auth.response
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, ...noStore })
    const row = await getServer(id)
    if (!row) return NextResponse.json({ error: 'Server not found' }, { status: 404, ...noStore })
    return NextResponse.json({ ssh: metadata(row) }, noStore)
  } catch (err) {
    console.error('[Servers SSH GET]', err)
    return NextResponse.json({ error: 'Failed to fetch SSH metadata' }, { status: 500, ...noStore })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireDashboardUser('Servers SSH PATCH')
    if (!auth.ok) return auth.response
    const body = await request.json()
    const {
      id,
      ssh_host,
      ssh_port,
      ssh_username,
      ssh_auth_type,
      private_key,
      passphrase,
      password,
      clear_private_key,
      clear_passphrase,
      clear_password,
    } = body as Record<string, unknown>

    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'id required' }, { status: 400, ...noStore })
    if (ssh_auth_type && !['key', 'password', 'key_password'].includes(String(ssh_auth_type))) {
      return NextResponse.json({ error: 'Invalid ssh_auth_type' }, { status: 400, ...noStore })
    }

    const updates: Record<string, unknown> = {}
    if (ssh_host !== undefined) updates.ssh_host = String(ssh_host || '').trim() || null
    if (ssh_port !== undefined) {
      const port = Number(ssh_port || 22)
      if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        return NextResponse.json({ error: 'Invalid SSH port' }, { status: 400, ...noStore })
      }
      updates.ssh_port = port
    }
    if (ssh_username !== undefined) updates.ssh_username = String(ssh_username || '').trim() || null
    if (ssh_auth_type !== undefined) updates.ssh_auth_type = ssh_auth_type || null
    if (typeof private_key === 'string' && private_key.trim()) updates.ssh_private_key_encrypted = encrypt(private_key)
    if (typeof passphrase === 'string' && passphrase) updates.ssh_passphrase_encrypted = encrypt(passphrase)
    if (typeof password === 'string' && password) updates.ssh_password_encrypted = encrypt(password)
    if (clear_private_key === true) updates.ssh_private_key_encrypted = null
    if (clear_passphrase === true) updates.ssh_passphrase_encrypted = null
    if (clear_password === true) updates.ssh_password_encrypted = null

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('server_status')
      .update(updates)
      .eq('id', id)
      .select('id, server_name, ping_secret, ssh_host, ssh_port, ssh_username, ssh_auth_type, ssh_private_key_encrypted, ssh_passphrase_encrypted, ssh_password_encrypted')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    return NextResponse.json({ ssh: metadata(data as ServerSshRow) }, noStore)
  } catch (err) {
    console.error('[Servers SSH PATCH]', err)
    return NextResponse.json({ error: 'Failed to save SSH settings' }, { status: 500, ...noStore })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDashboardUser('Servers SSH POST')
    if (!auth.ok) return auth.response
    const body = await request.json()
    const id = String(body.id || '')
    const action = String(body.action || 'test')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, ...noStore })

    const row = await getServer(id)
    if (!row) return NextResponse.json({ error: 'Server not found' }, { status: 404, ...noStore })
    const credentials = credentialsFromRow(row)

    if (action === 'test') {
      const result = await execSsh(credentials, 'printf "alfredo-ssh-ok\\n"; uname -a')
      return NextResponse.json({ ok: result.code === 0, result }, noStore)
    }

    if (action === 'install_daemon') {
      if (!row.ping_secret) {
        return NextResponse.json({ error: 'Server has no ping secret' }, { status: 400, ...noStore })
      }
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || APP_URL
      const scriptUrl = `${baseUrl}/api/daemon?secret=${row.ping_secret}`
      const serviceUrl = `${baseUrl}/api/daemon?secret=${row.ping_secret}&type=service`
      const command = [
        `sudo curl -fsSL '${scriptUrl}' -o /usr/local/bin/alfredo-daemon.sh`,
        `sudo chmod +x /usr/local/bin/alfredo-daemon.sh`,
        `tmp=$(mktemp)`,
        `curl -fsSL '${serviceUrl}' -o "$tmp"`,
        `sudo install -m 0644 "$tmp" /etc/systemd/system/alfredo-daemon.service`,
        `rm -f "$tmp"`,
        `sudo systemctl daemon-reload`,
        `sudo systemctl enable --now alfredo-daemon`,
      ].join(' && ')
      const result = await execSsh(credentials, command)
      return NextResponse.json({ ok: result.code === 0, result }, noStore)
    }

    return NextResponse.json({ error: 'Unsupported SSH action' }, { status: 400, ...noStore })
  } catch (err) {
    console.error('[Servers SSH POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'SSH action failed' }, { status: 500, ...noStore })
  }
}
