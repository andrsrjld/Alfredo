import { createAdminClient } from '@/lib/supabase/admin'
import { smartSearch, formatSearchContext } from '@/lib/search'
import { askAlfredo } from '@/lib/llm'
import { getMessagingProvider } from '@/lib/messaging'
import { normalizePhone } from '@/lib/phone'
import { shouldBotReply } from '@/lib/bot-mode'
import { markdownToWhatsApp } from '@/lib/messaging/whatsapp-format'
import { appendBuffer } from '@/lib/buffer'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function extractEvolutionMessage(body: Record<string, unknown>): {
  from: string
  text: string
  isGroup: boolean
  groupId?: string
  participant?: string
  senderName?: string
} | null {
  const data = (body?.data || body) as Record<string, unknown>
  const msgData = (data?.msg || data?.message || data) as Record<string, unknown> | undefined
  if (!msgData) return null

  let remoteJid = ''
  let participant = ''
  let text = ''
  let pushName: string | undefined

  const key = (msgData?.key || {}) as Record<string, unknown>
  if (key?.remoteJid) {
    remoteJid = key.remoteJid as string
  } else if (msgData?.from) {
    remoteJid = msgData.from as string
  }

  if (key?.participant && typeof key.participant === 'string') {
    participant = (key.participant as string).split('@')[0]
  }

  if (msgData?.pushName && typeof msgData.pushName === 'string') {
    pushName = (msgData.pushName as string).trim()
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

  if (!remoteJid || !text) return null

  const isGroup = remoteJid.endsWith('@g.us')
  const groupId = isGroup ? remoteJid : undefined

  if (isGroup && participant) {
    return { from: normalizePhone(participant), text, isGroup, groupId, participant: normalizePhone(participant), senderName: pushName }
  }

  const fromPhone = remoteJid.split('@')[0]
  return { from: normalizePhone(fromPhone), text, isGroup, groupId, senderName: pushName }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const msg = extractEvolutionMessage(body)

    if (!msg) {
      return NextResponse.json({ ok: true })
    }

    const { from, text, isGroup, groupId, participant } = msg

    if (isGroup && !/alfredo/i.test(text)) {
      return NextResponse.json({ ok: true, ignored: 'not_mentioned' })
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

    if (whitelist.is_active === false) {
      return NextResponse.json({ ok: true, ignored: 'contact_inactive' })
    }

    const { reply: shouldReply, mode } = await shouldBotReply()

    const replyTarget = isGroup ? groupId! : from

    if (!shouldReply) {
      return NextResponse.json({ ok: true, ignored: mode === 'human' ? 'human_mode' : 'outside_hours' })
    }

    const bufferResult = await appendBuffer(
      from,
      { text, ts: new Date().toISOString() },
      replyTarget,
      isGroup,
      groupId,
      participant,
    )
    if (bufferResult.action === 'buffered') {
      return NextResponse.json({ ok: true, buffered: true })
    }

    let queryText = text
    let promptText = text

    if (bufferResult.action === 'flush') {
      const oldTexts = bufferResult.flushMessages.map(m => m.text)
      const allTexts = [...oldTexts, text]
      queryText = allTexts.join('\n')
      promptText = `User mengirim beberapa pesan dalam waktu dekat:\n\n${allTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nJawab seluruh pertanyaan dalam SATU balasan.`
    }

    const results = await smartSearch(queryText)
    const context = formatSearchContext(results)
    const { reply, debug } = await askAlfredo(context, promptText)

    if (debug.error) {
      console.error(`[Evolution] LLM debug: provider=${debug.provider} hasContext=${debug.hasContext} ctxLen=${debug.contextLength} status=${debug.status} error=${debug.error}`)
    }

    const messenger = getMessagingProvider()
    await messenger.sendMessage(replyTarget, markdownToWhatsApp(reply), { isGroup, mentions: isGroup && participant ? [`${participant}@s.whatsapp.net`] : undefined })

    await supabase.from('chat_logs').insert({
      pm_number: from,
      pm_message: text,
      bot_reply: reply,
      is_group: isGroup,
      group_id: groupId || null,
    })

    return NextResponse.json({ ok: true, replied: true })
  } catch (err) {
    console.error('Evolution webhook error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}