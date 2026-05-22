import { createAdminClient } from '@/lib/supabase/admin'
import { smartSearch, formatSearchContext } from '@/lib/search'
import { askAlfredo } from '@/lib/llm'
import { getMessagingProvider } from '@/lib/messaging'
import { normalizePhone } from '@/lib/phone'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

export async function GET(request: NextRequest) {
  const provider = process.env.WA_PROVIDER || 'meta'

  if (provider === 'meta') {
    const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === process.env.WA_WEBHOOK_VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 })
    }
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  try {
    const provider = process.env.WA_PROVIDER || 'meta'

    let from = ''
    let text = ''

    if (provider === 'fonnte') {
      const formData = await request.formData()
      from = (formData.get('number') as string) || ''
      text = (formData.get('message') as string) || ''
    } else if (provider === 'evolution') {
      const body = await request.json()
      const data = body?.data || body
      const msgData = data?.msg || data?.message || data
      from = msgData?.from || msgData?.remoteJid?.split('@')[0] || ''
      text = msgData?.text || msgData?.body?.conversation || msgData?.conversation || ''
    } else {
      const body = await request.json()
      const parsed = extractMetaMessage(body)
      if (!parsed) {
        return NextResponse.json({ ok: true })
      }
      from = parsed.from
      text = parsed.text
    }

    if (!from || !text) {
      return NextResponse.json({ ok: true })
    }

    from = normalizePhone(from)
    console.log('[WhatsApp] incoming - normalized:', from, 'text:', text)

    if (!isWithinActiveHours()) {
      return NextResponse.json({ ok: true, ignored: 'outside_hours' })
    }

    const supabase = createAdminClient()

    const { data: whitelist } = await supabase
      .from('whitelisted_pms')
      .select('*')
      .eq('phone_number', from)
      .maybeSingle()

    if (!whitelist) {
      return NextResponse.json({ ok: true, ignored: 'not_whitelisted' })
    }

    const results = await smartSearch(text)
    const context = formatSearchContext(results)
    const { reply } = await askAlfredo(context, text)

    const messenger = getMessagingProvider()
    await messenger.sendMessage(from, reply)

    await supabase.from('chat_logs').insert({
      pm_number: from,
      pm_message: text,
      bot_reply: reply,
    })

    return NextResponse.json({ ok: true, replied: true })
  } catch (err) {
    console.error('Messaging webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function extractMetaMessage(body: unknown): { from: string; text: string } | null {
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