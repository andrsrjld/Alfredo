import { createAdminClient } from '@/lib/supabase/admin'
import { smartSearch, formatSearchContext } from '@/lib/search'
import { askAlfredo } from '@/lib/llm'
import { getMessagingProvider } from '@/lib/messaging'
import { normalizePhone } from '@/lib/phone'
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

async function extractFonnteMessage(request: NextRequest): Promise<{ from: string; text: string } | null> {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const body = await request.json()
      const from = body.number || body.phone || body.sender || ''
      const text = body.message || body.text || body.content || ''
      if (!from || !text) return null
      return { from: String(from), text: String(text) }
    } catch {
      return null
    }
  }

  try {
    const formData = await request.formData()
    const from = (formData.get('number') || formData.get('phone') || formData.get('sender') || '') as string
    const text = (formData.get('message') || formData.get('text') || formData.get('content') || '') as string
    if (!from || !text) return null
    return { from, text }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const msg = await extractFonnteMessage(request)

    if (!msg) {
      return NextResponse.json({ ok: true, detail: 'no_valid_message' })
    }

    const { from: rawFrom, text } = msg
    const from = normalizePhone(rawFrom)
    console.log('[Fonnte] incoming - raw:', rawFrom, 'normalized:', from, 'text:', text)

    if (!isWithinActiveHours()) {
      return NextResponse.json({ ok: true, ignored: 'outside_hours' })
    }

    const supabase = createAdminClient()

    const { data: whitelist, error: whitelistError } = await supabase
      .from('whitelisted_pms')
      .select('*')
      .eq('phone_number', from)
      .maybeSingle()

    if (whitelistError) {
      console.error('Fonnte whitelist query error:', whitelistError)
      return NextResponse.json({ ok: false, error: 'db_error', detail: whitelistError.message }, { status: 500 })
    }

    if (!whitelist) {
      const { data: allPms } = await supabase.from('whitelisted_pms').select('phone_number').limit(10)
      console.log('[Fonnte] not whitelisted:', from, '| DB entries:', JSON.stringify(allPms))
      return NextResponse.json({ ok: true, ignored: 'not_whitelisted', normalized: from, db_entries: allPms })
    }

    const results = await smartSearch(text)
    const context = formatSearchContext(results)
    const reply = await askAlfredo(context, text)

    const messenger = getMessagingProvider()
    await messenger.sendMessage(from, reply)

    const { error: logError } = await supabase.from('chat_logs').insert({
      pm_number: from,
      pm_message: text,
      bot_reply: reply,
    })

    if (logError) {
      console.error('Fonnte chat log error:', logError)
    }

    return NextResponse.json({ ok: true, replied: true })
  } catch (err) {
    console.error('Fonnte webhook error:', err)
    return NextResponse.json({ error: 'Internal error', detail: String(err) }, { status: 500 })
  }
}