import { createAdminClient } from './supabase/admin'

export type BotMode = 'normal' | 'extended' | 'human'

const HUMAN_MODE_REPLY =
  'Halo! 🤖 Ijal sedang online sekarang. Silakan hubungi langsung ya — Alfredo standby.'

interface CachedBotMode {
  mode: BotMode
  expiresAt: number
}

let cachedBotMode: CachedBotMode | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

function isWithinActiveHours(): boolean {
  const tz = process.env.BOT_TIMEZONE || 'Asia/Jakarta'
  const startStr = process.env.BOT_ACTIVE_START || '03:00'
  const endStr = process.env.BOT_ACTIVE_END || '12:00'

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

export async function getBotMode(): Promise<BotMode> {
  if (cachedBotMode && Date.now() < cachedBotMode.expiresAt) {
    return cachedBotMode.mode
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
      if (['normal', 'extended', 'human'].includes(mode)) {
        cachedBotMode = { mode, expiresAt: Date.now() + CACHE_TTL_MS }
        return mode
      }
    }
  } catch {
  }

  cachedBotMode = { mode: 'normal', expiresAt: Date.now() + CACHE_TTL_MS }
  return 'normal'
}

export async function shouldBotReply(): Promise<{ reply: boolean; mode: BotMode; humanReply?: string }> {
  const mode = await getBotMode()

  if (mode === 'human') {
    return { reply: false, mode: 'human', humanReply: HUMAN_MODE_REPLY }
  }

  if (mode === 'extended') {
    return { reply: true, mode: 'extended' }
  }

  return { reply: isWithinActiveHours(), mode: 'normal' }
}

export function invalidateBotModeCache() {
  cachedBotMode = null
}