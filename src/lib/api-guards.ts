import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

function isProd(): boolean {
  // Vercel sets VERCEL=1, and Next sets NODE_ENV=production for production builds.
  return process.env.NODE_ENV === 'production' || !!process.env.VERCEL
}

export async function requireDashboardUser(requestLabel: string) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) {
      return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore }) }
    }
    return { ok: true as const, user: data.user }
  } catch (err) {
    console.error(`[${requestLabel}] Auth check failed:`, err)
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore }) }
  }
}

export function requireSharedWebhookSecret(request: NextRequest, requestLabel: string): NextResponse | null {
  const secret = process.env.WA_WEBHOOK_SECRET

  if (!secret) {
    if (isProd()) {
      console.error(`[${requestLabel}] WA_WEBHOOK_SECRET not configured (blocking in production).`)
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500, ...noStore })
    }
    console.warn(`[${requestLabel}] WA_WEBHOOK_SECRET not configured (allowing in non-production).`)
    return null
  }

  const provided =
    request.headers.get('x-alfredo-webhook-secret') ||
    request.headers.get('x-webhook-secret') ||
    new URL(request.url).searchParams.get('secret')

  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
  }

  return null
}

export async function requireMetaSignatureOrSecret(request: NextRequest, rawBody: string, requestLabel: string): Promise<NextResponse | null> {
  // Prefer Meta's request signature validation when WA_APP_SECRET is set.
  const appSecret = process.env.WA_APP_SECRET

  if (!appSecret) {
    // Fall back to shared secret (works for non-Meta providers too, and keeps setup simple).
    return requireSharedWebhookSecret(request, requestLabel)
  }

  const signature = request.headers.get('x-hub-signature-256') || ''
  if (!signature.startsWith('sha256=')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
  }

  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')

  // Constant-time compare
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
  }

  return null
}

