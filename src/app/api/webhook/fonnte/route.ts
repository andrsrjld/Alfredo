import { createAdminClient } from '@/lib/supabase/admin'
import { smartSearch, formatSearchContext } from '@/lib/search'
import { askAlfredo } from '@/lib/llm'
import { getMessagingProvider } from '@/lib/messaging'
import { normalizePhone } from '@/lib/phone'
import { shouldBotReply } from '@/lib/bot-mode'
import { markdownToWhatsApp } from '@/lib/messaging/whatsapp-format'
import { NextRequest, NextResponse } from 'next/server'
import { requireSharedWebhookSecret } from '@/lib/api-guards'

export const dynamic = 'force-dynamic'

async function extractFonnteMessage(request: NextRequest): Promise<{
  from: string
  text: string
  isGroup: boolean
  groupId?: string
  senderInGroup?: string
  senderName?: string
} | null> {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const body = await request.json()
      const sender = String(body.sender || body.number || body.phone || '')
      const text = String(body.message || body.text || body.content || '')
      const member = body.member ? String(body.member) : undefined
      const name = String(body.name || body.senderName || body.pushName || body.contactName || body.notifyName || '').trim() || undefined
      if (!sender || !text) return null

      const isGroup = !!member
      const groupId = isGroup ? sender : undefined
      const from = isGroup ? normalizePhone(member!) : normalizePhone(sender)

      return { from, text, isGroup, groupId, senderInGroup: isGroup ? normalizePhone(member!) : undefined, senderName: name }
    } catch {
      return null
    }
  }

  try {
    const formData = await request.formData()
    const sender = (formData.get('sender') || formData.get('number') || formData.get('phone') || '') as string
    const text = (formData.get('message') || formData.get('text') || formData.get('content') || '') as string
    const member = (formData.get('member') || '') as string
    const name = (formData.get('name') || '') as string
    if (!sender || !text) return null

    const isGroup = !!member
    const groupId = isGroup ? sender : undefined
    const from = isGroup ? normalizePhone(member) : normalizePhone(sender)
    const senderName = name ? name.trim() : undefined

    return { from, text, isGroup, groupId, senderInGroup: isGroup ? normalizePhone(member) : undefined, senderName }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const unauthorized = requireSharedWebhookSecret(request, 'Fonnte webhook')
    if (unauthorized) return unauthorized

    const msg = await extractFonnteMessage(request)

    if (!msg) {
      return NextResponse.json({ ok: true, detail: 'no_valid_message' })
    }

    const { from, text, isGroup, groupId } = msg

    if (isGroup && !/alfredo/i.test(text)) {
      return NextResponse.json({ ok: true, ignored: 'not_mentioned' })
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
      return NextResponse.json({ ok: true, ignored: 'not_whitelisted' })
    }

    if (whitelist.is_active === false) {
      return NextResponse.json({ ok: true, ignored: 'contact_inactive' })
    }

    const { reply: shouldReply, mode } = await shouldBotReply()

    const replyTarget = isGroup ? groupId! : from

    if (!shouldReply) {
      return NextResponse.json({ ok: true, ignored: mode === 'human' ? 'human_mode' : 'outside_hours' })
    }

    const results = await smartSearch(text)
    const context = formatSearchContext(results)
    const { reply, debug } = await askAlfredo(context, text)

    if (debug.error) {
      console.error(`[Fonnte] LLM debug: provider=${debug.provider} hasContext=${debug.hasContext} ctxLen=${debug.contextLength} status=${debug.status} error=${debug.error}`)
    }

    const messenger = getMessagingProvider()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sendOpts = isGroup ? { isGroup: true } : undefined
    await messenger.sendMessage(replyTarget, markdownToWhatsApp(reply), sendOpts)

    const { error: logError } = await supabase.from('chat_logs').insert({
      pm_number: from,
      pm_message: text,
      bot_reply: reply,
      is_group: isGroup,
      group_id: groupId || null,
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
