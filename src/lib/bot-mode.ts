import { createAdminClient } from './supabase/admin'

export type BotMode = 'normal' | 'extended' | 'human'

const HUMAN_MODE_REPLY =
  'Halo! 🤖 Ijal sedang online sekarang. Silakan hubungi langsung ya — Alfredo standby.'

const DEFAULT_ACTIVE_START = '03:00'
const DEFAULT_ACTIVE_END = '12:00'

interface CachedBotMode {
  mode: BotMode
  activeStart: string
  activeEnd: string
  expiresAt: number
}

let cachedBotMode: CachedBotMode | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

function isWithinActiveHours(startStr: string, endStr: string): boolean {
  const tz = process.env.BOT_TIMEZONE || 'Asia/Jakarta'
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const timeStr = formatter.format(now)
  const [hours, minutes] = timeStr.split(':').map(Number)
  const current = hours * 60 + minutes

  const [startH, startM] = startStr.split(':').map(Number)
  const [endH, endM] = endStr.split(':').map(Number)
  const start = startH * 60 + startM
  const end = endH * 60 + endM

  if (start <= end) {
    return current >= start && current <= end
  }
  return current >= start || current <= end
}

export async function getBotMode(): Promise<{ mode: BotMode; activeStart: string; activeEnd: string }> {
  if (cachedBotMode && Date.now() < cachedBotMode.expiresAt) {
    return { mode: cachedBotMode.mode, activeStart: cachedBotMode.activeStart, activeEnd: cachedBotMode.activeEnd }
  }

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_config')
      .single()

    if (data) {
      const config = data.value as Record<string, unknown>
      const mode = (config.bot_mode as BotMode) || 'normal'
      const activeStart = (config.active_start as string) || process.env.BOT_ACTIVE_START || DEFAULT_ACTIVE_START
      const activeEnd = (config.active_end as string) || process.env.BOT_ACTIVE_END || DEFAULT_ACTIVE_END
      if (['normal', 'extended', 'human'].includes(mode)) {
        cachedBotMode = { mode, activeStart, activeEnd, expiresAt: Date.now() + CACHE_TTL_MS }
        return { mode, activeStart, activeEnd }
      }
    }
  } catch {}

  const fallback: CachedBotMode = {
    mode: 'normal',
    activeStart: process.env.BOT_ACTIVE_START || DEFAULT_ACTIVE_START,
    activeEnd: process.env.BOT_ACTIVE_END || DEFAULT_ACTIVE_END,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }
  cachedBotMode = fallback
  return { mode: fallback.mode, activeStart: fallback.activeStart, activeEnd: fallback.activeEnd }
}

export async function shouldBotReply(): Promise<{ reply: boolean; mode: BotMode; humanReply?: string }> {
  const { mode, activeStart, activeEnd } = await getBotMode()

  if (mode === 'human') {
    return { reply: false, mode: 'human', humanReply: HUMAN_MODE_REPLY }
  }

  if (mode === 'extended') {
    return { reply: true, mode: 'extended' }
  }

  return { reply: isWithinActiveHours(activeStart, activeEnd), mode: 'normal' }
}

export function invalidateBotModeCache() {
  cachedBotMode = null
}