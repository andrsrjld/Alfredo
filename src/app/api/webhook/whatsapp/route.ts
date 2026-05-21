import { createAdminClient } from '@/lib/supabase/admin'
import { smartSearch, formatSearchContext } from '@/lib/search'
import { askAlfredo } from '@/lib/llm'
import { NextRequest, NextResponse } from 'next/server'

function isWithinActiveHours(): boolean {
  const tz = process.env.BOT_TIMEZONE || 'Asia/Jakarta'
  const now = new Date().toLocaleString('en-US', { timeZone: tz })
  const date = new Date(now)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const current = hours * 60 + minutes

  const [startH, startM] = (process.env.BOT_ACTIVE_START || '06:00').split(':').map(Number)
  const [endH, endM] = (process.env.BOT_ACTIVE_END || '12:00').split(':').map(Number)
  const start = startH * 60 + startM
  const end = endH * 60 + endM

  return current >= start && current <= end
}

function extractMessage(body: unknown): { from: string; text: string } | null {
  try {
    const b = body as Record<string, unknown>
    const entry = (b.entry as Record<string, unknown>[] | undefined)?.[0]
    const change = (entry?.changes as Record<string, unknown>[] | undefined)?.[0]
    const value = change?.value as Record<string, unknown> | undefined
    const message = (value?.messages as Record<string, unknown>[] | undefined)?.[0]
    if (!message || message.type !== 'text') return null
    return {
      from: message.from as string,
      text: ((message.text as Record<string, unknown> | undefined)?.body as string) || '',
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WA_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const msg = extractMessage(body)

    if (!msg) {
      return NextResponse.json({ ok: true })
    }

    const { from, text } = msg

    // Gatekeeper 1: time window
    if (!isWithinActiveHours()) {
      return NextResponse.json({ ok: true, ignored: 'outside_hours' })
    }

    const supabase = createAdminClient()

    // Gatekeeper 2: whitelist
    const { data: whitelist } = await supabase
      .from('whitelisted_pms')
      .select('*')
      .eq('phone_number', from)
      .maybeSingle()

    if (!whitelist) {
      return NextResponse.json({ ok: true, ignored: 'not_whitelisted' })
    }

    // Context retrieval
    const results = await smartSearch(text)
    const context = formatSearchContext(results)

    // LLM invocation
    const reply = await askAlfredo(context, text)

    // Send reply via Meta API
    const phoneId = process.env.WA_PHONE_NUMBER_ID
    const token = process.env.WA_ACCESS_TOKEN
    if (phoneId && token) {
      await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: from,
          text: { body: reply },
        }),
      })
    }

    // Logging
    await supabase.from('chat_logs').insert({
      pm_number: from,
      pm_message: text,
      bot_reply: reply,
    })

    return NextResponse.json({ ok: true, replied: true })
  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
