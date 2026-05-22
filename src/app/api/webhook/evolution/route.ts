import { createAdminClient } from '@/lib/supabase/admin'
import { smartSearch, formatSearchContext } from '@/lib/search'
import { askAlfredo } from '@/lib/llm'
import { getMessagingProvider } from '@/lib/messaging'
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

function extractEvolutionMessage(body: Record<string, unknown>): { from: string; text: string } | null {
  const data = (body?.data || body) as Record<string, unknown>
  const msgData = (data?.msg || data?.message || data) as Record<string, unknown> | undefined
  if (!msgData) return null

  let from = ''
  let text = ''

  const key = (msgData?.key || {}) as Record<string, unknown>
  if (key?.remoteJid) {
    from = (key.remoteJid as string).split('@')[0]
  } else if (msgData?.from) {
    from = msgData.from as string
  }

  const bodyField = msgData?.body
  if (typeof bodyField === 'string') {
    text = bodyField
  } else if (bodyField && typeof bodyField === 'object') {
    const bodyObj = bodyField as Record<string, unknown>
    if (bodyObj.conversation) text = bodyObj.conversation as string
  }

  if (msgData?.conversation && typeof msgData.conversation === 'string') {
    text = msgData.conversation
  } else if (msgData?.text && typeof msgData.text === 'string') {
    text = msgData.text as string
  }

  if (!from || !text) return null
  return { from, text }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const msg = extractEvolutionMessage(body)

    if (!msg) {
      return NextResponse.json({ ok: true })
    }

    const { from, text } = msg

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
    const reply = await askAlfredo(context, text)

    const messenger = getMessagingProvider()
    await messenger.sendMessage(from, reply)

    await supabase.from('chat_logs').insert({
      pm_number: from,
      pm_message: text,
      bot_reply: reply,
    })

    return NextResponse.json({ ok: true, replied: true })
  } catch (err) {
    console.error('Evolution webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}