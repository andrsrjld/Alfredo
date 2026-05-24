import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { smartSearch, formatSearchContext } from '@/lib/search'
import { askAlfredo } from '@/lib/llm'
import { getMessagingProvider } from '@/lib/messaging'
import { markdownToWhatsApp } from '@/lib/messaging/whatsapp-format'
import type { BufferEntry } from '@/lib/buffer'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization') || ''
    const secret = process.env.BUFFER_FLUSH_CRON_SECRET
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const silenceMs = parseInt(process.env.MESSAGE_BUFFER_SILENCE_MS || '15000', 10)
    const cutoff = new Date(Date.now() - silenceMs).toISOString()

    const { data: buffers, error } = await supabase
      .from('message_buffer')
      .select('*')
      .lt('last_message_at', cutoff)

    if (error) {
      console.error('[FlushBuffers] query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!buffers || buffers.length === 0) {
      return NextResponse.json({ flushed: 0 })
    }

    const messenger = getMessagingProvider()
    let flushed = 0

    for (const buf of buffers) {
      const entry = buf as BufferEntry
      const texts = (entry.messages as Array<{ text: string }>).map(m => m.text).filter(Boolean)

      if (texts.length === 0) {
        await supabase.from('message_buffer').delete().eq('pm_number', entry.pm_number)
        continue
      }

      const query = texts.join('\n')
      const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join('\n')

      const results = await smartSearch(query)
      const context = formatSearchContext(results)
      const { reply } = await askAlfredo(context, `User mengirim beberapa pesan dalam waktu dekat:\n\n${numbered}\n\nJawab seluruh pertanyaan dalam SATU balasan. Gunakan data yang tersedia untuk menjawab sebanyak mungkin.`)

      try {
        await messenger.sendMessage(
          entry.reply_target,
          markdownToWhatsApp(reply),
          {
            isGroup: entry.is_group ? true : undefined,
            mentions: entry.is_group && entry.participant ? [`${entry.participant}@s.whatsapp.net`] : undefined,
          },
        )
        flushed++
      } catch (sendErr) {
        console.error(`[FlushBuffers] send failed for ${entry.pm_number}:`, sendErr)
      }

      await supabase
        .from('chat_logs')
        .insert({
          pm_number: entry.pm_number,
          pm_message: texts.join('\n'),
          bot_reply: reply,
          is_group: entry.is_group,
          group_id: entry.group_id || null,
        })

      await supabase
        .from('message_buffer')
        .delete()
        .eq('pm_number', entry.pm_number)
    }

    return NextResponse.json({ flushed }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[FlushBuffers] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
