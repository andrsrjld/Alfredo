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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const from = (formData.get('number') as string) || ''
    const text = (formData.get('message') as string) || ''

    if (!from || !text) {
      return NextResponse.json({ ok: true })
    }

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
    console.error('Fonnte webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}