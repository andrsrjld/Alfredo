import { createAdminClient } from '@/lib/supabase/admin'
import { smartSearch, formatSearchContext } from '@/lib/search'
import { askAlfredo } from '@/lib/llm'
import { getMessagingProvider } from '@/lib/messaging'
import { normalizePhone } from '@/lib/phone'
import { shouldBotReply } from '@/lib/bot-mode'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const WIT_PREFIX = /^wit\s+/i

async function autoWhitelistIfWIT(phone: string, name: string | undefined): Promise<boolean> {
  if (!name || !WIT_PREFIX.test(name)) return false
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('whitelisted_pms')
    .upsert({ phone_number: phone, pm_name: name.trim() }, { onConflict: 'phone_number' })
  if (error) {
    console.error('[Fonnte] Auto-whitelist error:', error)
    return false
  }
  console.log(`[Fonnte] Auto-whitelisted: ${phone} → ${name.trim()}`)
  return true
}

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
      console.log('[Fonnte] JSON payload keys:', Object.keys(body).join(','), '| name:', body.name, '| senderName:', body.senderName, '| pushName:', body.pushName, '| contactName:', body.contactName, '| notifyName:', body.notifyName)

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
    const msg = await extractFonnteMessage(request)

    if (!msg) {
      return NextResponse.json({ ok: true, detail: 'no_valid_message' })
    }

    const { from, text, isGroup, groupId, senderName } = msg
    console.log('[Fonnte] from:', from, 'senderName:', senderName, 'text:', text?.slice(0, 50), 'isGroup:', isGroup)

    if (isGroup && !/alfredo/i.test(text)) {
      return NextResponse.json({ ok: true, ignored: 'not_mentioned' })
    }

    const supabase = createAdminClient()

    await autoWhitelistIfWIT(from, senderName)

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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