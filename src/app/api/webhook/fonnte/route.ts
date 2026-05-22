import { createAdminClient } from '@/lib/supabase/admin'
import { smartSearch, formatSearchContext } from '@/lib/search'
import { askAlfredo } from '@/lib/llm'
import { getMessagingProvider } from '@/lib/messaging'
import { normalizePhone } from '@/lib/phone'
import { shouldBotReply } from '@/lib/bot-mode'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function extractFonnteMessage(request: NextRequest): Promise<{
  from: string
  text: string
  isGroup: boolean
  groupId?: string
  senderInGroup?: string
} | null> {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const body = await request.json()
      const sender = String(body.sender || body.number || body.phone || '')
      const text = String(body.message || body.text || body.content || '')
      const member = body.member ? String(body.member) : undefined
      if (!sender || !text) return null

      const isGroup = !!member
      const groupId = isGroup ? sender : undefined
      const from = isGroup ? normalizePhone(member!) : normalizePhone(sender)

      return { from, text, isGroup, groupId, senderInGroup: isGroup ? normalizePhone(member!) : undefined }
    } catch {
      return null
    }
  }

  try {
    const formData = await request.formData()
    const sender = (formData.get('sender') || formData.get('number') || formData.get('phone') || '') as string
    const text = (formData.get('message') || formData.get('text') || formData.get('content') || '') as string
    const member = (formData.get('member') || '') as string
    if (!sender || !text) return null

    const isGroup = !!member
    const groupId = isGroup ? sender : undefined
    const from = isGroup ? normalizePhone(member) : normalizePhone(sender)

    return { from, text, isGroup, groupId, senderInGroup: isGroup ? normalizePhone(member) : undefined }
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

    const { from, text, isGroup, groupId } = msg

    const supabase = createAdminClient()
    const { reply: shouldReply, mode, humanReply } = await shouldBotReply()

    const replyTarget = isGroup ? groupId! : from

    if (!shouldReply) {
      if (mode === 'human' && humanReply) {
        const messenger = getMessagingProvider()
        await messenger.sendMessage(replyTarget, humanReply, { isGroup })
        await supabase.from('chat_logs').insert({
          pm_number: from,
          pm_message: text,
          bot_reply: humanReply,
          is_group: isGroup,
          group_id: groupId || null,
        })
      }
      return NextResponse.json({ ok: true, ignored: mode === 'human' ? 'human_mode' : 'outside_hours' })
    }

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

    const results = await smartSearch(text)
    const context = formatSearchContext(results)
    const { reply } = await askAlfredo(context, text)

    const messenger = getMessagingProvider()
    const sendOpts = isGroup ? { isGroup: true } : undefined
    await messenger.sendMessage(replyTarget, reply, sendOpts)

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