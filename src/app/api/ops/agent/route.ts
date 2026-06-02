import { NextRequest, NextResponse } from 'next/server'
import {
  OPS_NO_STORE_HEADERS,
  authenticateAgent,
  claimNextAgentCommand,
  recordAgentResult,
  recordServiceDiscovery,
} from '@/lib/ops/service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get('secret')
    const serverName = await authenticateAgent(secret)
    if (!serverName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: OPS_NO_STORE_HEADERS })
    }

    const command = await claimNextAgentCommand(serverName)
    return NextResponse.json({ command }, { headers: OPS_NO_STORE_HEADERS })
  } catch (err) {
    console.error('[ops/agent GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: OPS_NO_STORE_HEADERS })
  }
}

export async function POST(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get('secret')
    const serverName = await authenticateAgent(secret)
    if (!serverName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: OPS_NO_STORE_HEADERS })
    }

    const body = await request.json().catch(() => ({}))
    if (Array.isArray(body.services)) {
      await recordServiceDiscovery(serverName, body.services)
    }
    if (body.command_id) {
      await recordAgentResult({
        commandId: String(body.command_id),
        serverName,
        ok: body.ok === true,
        output: typeof body.output === 'string' ? body.output : null,
        error: typeof body.error === 'string' ? body.error : null,
      })
    }

    return NextResponse.json({ ok: true }, { headers: OPS_NO_STORE_HEADERS })
  } catch (err) {
    console.error('[ops/agent POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: OPS_NO_STORE_HEADERS })
  }
}
