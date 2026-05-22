import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!secret) {
    return new NextResponse('# Error: secret query parameter required\n', {
      status: 400,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    })
  }

  const supabase = createAdminClient()
  const { data: server } = await supabase
    .from('server_status')
    .select('server_name')
    .eq('ping_secret', secret)
    .maybeSingle()

  if (!server) {
    return new NextResponse('# Error: invalid secret\n', {
      status: 403,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    })
  }

  const serverName = server.server_name
  const unit = `[Unit]
Description=Alfredo Daemon - ${serverName}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=NODE_OPTIONS="--experimental-network-imports"
ExecStart=/bin/sh -c 'exec "$(which node)" /usr/local/bin/alfredo-daemon.mjs'
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=alfredo-daemon

[Install]
WantedBy=multi-user.target
`

  return new NextResponse(unit, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="alfredo-daemon.service"',
      'Cache-Control': 'no-store',
    },
  })
}