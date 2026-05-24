import { createAdminClient } from '@/lib/supabase/admin'
import { smartSearch, formatSearchContext } from '@/lib/search'
import { askAlfredo } from '@/lib/llm'
import { getMessagingProvider } from '@/lib/messaging'
import { markdownToWhatsApp } from '@/lib/messaging/whatsapp-format'
import type { BufferEntry } from '@/lib/buffer'
import { NextRequest, NextResponse } from 'next/server'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

export const dynamic = 'force-dynamic'

const SILENCE_MS = parseInt(process.env.MESSAGE_BUFFER_SILENCE_MS || '15000', 10)
let lastFlushTime = 0

interface ContainerPayload {
  name: string
  image?: string
  status: string
  uptime?: string
  ports?: string
  error_log?: string
}

interface MetricsPayload {
  cpu?: number
  memory?: number
  disk?: number
  uptime_hours?: number
  containers?: ContainerPayload[]
}

async function authenticate(request: NextRequest, supabase: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const url = new URL(request.url)
  const secret = url.searchParams.get('secret')
  if (!secret) return null

  const { data: server } = await supabase
    .from('server_status')
    .select('server_name')
    .eq('ping_secret', secret)
    .maybeSingle()

  return server?.server_name || null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const serverName = await authenticate(request, supabase)
    if (!serverName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
    }

    const { error } = await supabase
      .from('server_status')
      .update({ status: 'online', last_ping: new Date().toISOString() })
      .eq('server_name', serverName)

    if (error) {
      console.error('[Server ping] GET upsert error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500, ...noStore })
    }

    return NextResponse.json({ ok: true }, noStore)
  } catch (err) {
    console.error('[Server ping] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, ...noStore })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const serverName = await authenticate(request, supabase)
    if (!serverName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, ...noStore })
    }

    let metrics: MetricsPayload = {}
    try {
      metrics = await request.json()
    } catch {
      metrics = {}
    }

    const { cpu, memory, disk, uptime_hours, containers } = metrics

    const update: Record<string, unknown> = {
      status: 'online',
      last_ping: new Date().toISOString(),
    }
    if (typeof cpu === 'number' && !Number.isNaN(cpu)) update.cpu_usage = cpu
    if (typeof memory === 'number' && !Number.isNaN(memory)) update.memory_usage = memory
    if (typeof disk === 'number' && !Number.isNaN(disk)) update.disk_usage = disk
    if (typeof uptime_hours === 'number' && !Number.isNaN(uptime_hours)) update.uptime_hours = uptime_hours

    const { error: serverError } = await supabase
      .from('server_status')
      .update(update)
      .eq('server_name', serverName)

    if (serverError) {
      console.error('[Server ping] POST server upsert error:', serverError)
      return NextResponse.json({ error: 'Database error' }, { status: 500, ...noStore })
    }

    if (containers && Array.isArray(containers) && containers.length > 0) {
      const containerUpserts = containers
        .filter(c => c.name)
        .map(c => ({
          server_name: serverName,
          container_name: c.name,
          image: c.image || null,
          status: normalizeContainerStatus(c.status),
          uptime: c.uptime || null,
          ports: c.ports || null,
          error_log: c.error_log || null,
          last_updated: new Date().toISOString(),
        }))

      if (containerUpserts.length > 0) {
        const { error: deleteError } = await supabase
          .from('container_status')
          .delete()
          .eq('server_name', serverName)

        if (deleteError) {
          console.error('[Server ping] Container stale delete error:', deleteError)
        }

        const { error: containerError } = await supabase
          .from('container_status')
          .upsert(containerUpserts, { onConflict: 'server_name,container_name' })

        if (containerError) {
          console.error('[Server ping] Container upsert error:', containerError)
        }
      }
    }

    const now = Date.now()
    if (now - lastFlushTime > 10000) {
      lastFlushTime = now
      flushExpiredBuffers().catch(err => console.error('[Server ping] background flush error:', err))
    }

    return NextResponse.json({ ok: true, server: serverName, stored: { cpu, memory, disk, uptime_hours } }, noStore)
  } catch (err) {
    console.error('[Server ping] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, ...noStore })
  }
}

function normalizeContainerStatus(status: string): string {
  if (!status) return 'unknown'
  const s = status.toLowerCase()
  if (s.includes('up') || s.includes('running')) return 'running'
  if (s.includes('exit') || s.includes('exited')) return 'exited'
  if (s.includes('dead')) return 'dead'
  if (s.includes('restart')) return 'restarting'
  if (s.includes('pause')) return 'paused'
  if (s.includes('creat')) return 'created'
  return s
}

async function flushExpiredBuffers() {
  try {
    const supabase = createAdminClient()
    const cutoff = new Date(Date.now() - SILENCE_MS).toISOString()

    const { data: buffers } = await supabase
      .from('message_buffer')
      .select('*')
      .lt('last_message_at', cutoff)

    if (!buffers || buffers.length === 0) return

    const messenger = getMessagingProvider()

    for (const buf of buffers) {
      const entry = buf as BufferEntry
      const texts = (entry.messages as Array<{ text: string }>).map(m => m.text).filter(Boolean)

      try {
        if (texts.length > 0) {
          const query = texts.join('\n')
          const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join('\n')
          const results = await smartSearch(query)
          const context = formatSearchContext(results)
          const { reply } = await askAlfredo(context, `User mengirim beberapa pesan dalam waktu dekat:\n\n${numbered}\n\nJawab seluruh pertanyaan dalam SATU balasan.`)

          await messenger.sendMessage(
            entry.reply_target,
            markdownToWhatsApp(reply),
            {
              isGroup: entry.is_group ? true : undefined,
              mentions: entry.is_group && entry.participant ? [`${entry.participant}@s.whatsapp.net`] : undefined,
            },
          )

          await supabase.from('chat_logs').insert({
            pm_number: entry.pm_number,
            pm_message: texts.join('\n'),
            bot_reply: reply,
            is_group: entry.is_group,
            group_id: entry.group_id || null,
          })
        }

        await supabase.from('message_buffer').delete().eq('pm_number', entry.pm_number)
      } catch (flushErr) {
        console.error(`[Server ping] flush failed for ${entry.pm_number}:`, flushErr)
      }
    }
  } catch (err) {
    console.error('[Server ping] flushExpiredBuffers error:', err)
  }
}