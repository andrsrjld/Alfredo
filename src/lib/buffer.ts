import { createAdminClient } from '@/lib/supabase/admin'

const SILENCE_MS = parseInt(process.env.MESSAGE_BUFFER_SILENCE_MS || '15000', 10)

export type BufferEntry = {
  pm_number: string
  messages: Array<{ text: string; ts: string }>
  reply_target: string
  first_message_at: string
  last_message_at: string
  is_group: boolean
  group_id: string | null
  participant: string | null
}

export async function getBuffer(pm_number: string): Promise<BufferEntry | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('message_buffer')
    .select('*')
    .eq('pm_number', pm_number)
    .maybeSingle()

  return data as BufferEntry | null
}

export async function appendBuffer(
  pm_number: string,
  message: { text: string; ts: string },
  reply_target: string,
  is_group: boolean,
  group_id?: string,
  participant?: string,
): Promise<{ buffered: boolean; shouldFlush: boolean }> {
  const supabase = createAdminClient()

  try {
    const existing = await getBuffer(pm_number)

    if (!existing) {
      await supabase.from('message_buffer').insert({
        pm_number,
        messages: JSON.stringify([message]),
        reply_target,
        first_message_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        is_group,
        group_id: group_id || null,
        participant: participant || null,
      })
      return { buffered: true, shouldFlush: false }
    }

    const lastAt = new Date(existing.last_message_at).getTime()
    const now = Date.now()
    const expired = (now - lastAt) > SILENCE_MS

    if (expired) {
      return { buffered: false, shouldFlush: true }
    }

    const messages = existing.messages as Array<{ text: string; ts: string }>
    messages.push(message)

    await supabase
      .from('message_buffer')
      .update({
        messages,
        last_message_at: new Date().toISOString(),
      })
      .eq('pm_number', pm_number)

    return { buffered: true, shouldFlush: false }
  } catch (err) {
    console.error('[Buffer] append failed, falling through to direct reply:', String(err))
    return { buffered: false, shouldFlush: false }
  }
}

export async function deleteBuffer(pm_number: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('message_buffer')
    .delete()
    .eq('pm_number', pm_number)
}

export function isWithinSilenceWindow(lastMessageAt: string): boolean {
  const elapsed = Date.now() - new Date(lastMessageAt).getTime()
  return elapsed <= SILENCE_MS
}
