import { createAdminClient } from '@/lib/supabase/admin'
import { smartSearch, formatSearchContext } from '@/lib/search'
import { askAlfredo } from '@/lib/llm'
import { getMessagingProvider } from '@/lib/messaging'
import { normalizePhone } from '@/lib/phone'
import { shouldBotReply } from '@/lib/bot-mode'
import { markdownToWhatsApp } from '@/lib/messaging/whatsapp-format'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

    const supabase = createAdminClient()

    const { data: whitelist } = await supabase
      .from('whitelisted_pms')
      .select('*')
      .eq('phone_number', from)
      .maybeSingle()

    if (!whitelist) {
      return NextResponse.json({ ok: true, ignored: 'not_whitelisted' })
    }

    if (whitelist.is_active === false) {
      return NextResponse.json({ ok: true, ignored: 'contact_inactive' })
    }

    const { reply: shouldReply, mode } = await shouldBotReply()

    if (!shouldReply) {
      return NextResponse.json({ ok: true, ignored: mode === 'human' ? 'human_mode' : 'outside_hours' })
    }

    const results = await smartSearch(text)
    const context = formatSearchContext(results)
    const { reply, debug } = await askAlfredo(context, text)

    if (debug.error) {
      console.error(`[WhatsApp] LLM debug: provider=${debug.provider} hasContext=${debug.hasContext} ctxLen=${debug.contextLength} status=${debug.status} error=${debug.error}`)
    }

    const messenger = getMessagingProvider()
    await messenger.sendMessage(from, markdownToWhatsApp(reply))

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