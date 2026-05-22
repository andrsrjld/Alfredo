import { createAdminClient } from './supabase/admin'
import { decrypt } from './encryption'

const FALLBACK_REPLY =
  'Mohon maaf Bapak/Ibu, status yang Bapak/Ibu tanyakan tidak tercatat dalam log serah terima sistem kami. Christian akan melakukan pengecekan manual dan merespons setelah pukul 12.00.'

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string; authHeader: string; authPrefix: string }> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  ollama: {
    baseUrl: 'https://ollama.com/api/chat',
    model: 'deepseek-v4-flash',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
}

interface LLMConfig {
  url: string
  key: string
  model: string
  provider: string
}

interface CachedConfig {
  config: LLMConfig
  expiresAt: number
}

let cachedConfig: CachedConfig | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

function getEnvConfig(): LLMConfig {
  const provider = process.env.AI_PROVIDER || 'deepseek'
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek
  const envKey = provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY
    : provider === 'openai' ? process.env.OPENAI_API_KEY
    : provider === 'gemini' ? process.env.GEMINI_API_KEY
    : provider === 'ollama' ? process.env.OLLAMA_API_KEY
    : process.env.DEEPSEEK_API_KEY || ''

  return {
    provider,
    url: process.env.AI_BASE_URL || defaults.baseUrl,
    key: envKey || '',
    model: process.env.AI_MODEL || defaults.model,
  }
}

async function getDBConfig(): Promise<LLMConfig | null> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_config')
      .single()

    if (error || !data) return null

    const config = data.value as {
      provider?: string
      temperature?: number
      models?: Record<string, {
        apiKey?: string
        model?: string
        baseUrl?: string
      }>
    }

    const provider = config.provider || 'deepseek'
    const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek
    const modelConfig = config.models?.[provider]

    if (!modelConfig?.apiKey) return null

    let apiKey: string
    try {
      apiKey = decrypt(modelConfig.apiKey)
    } catch {
      apiKey = modelConfig.apiKey
    }

    return {
      provider,
      url: modelConfig.baseUrl || defaults.baseUrl,
      key: apiKey,
      model: modelConfig.model || defaults.model,
    }
  } catch {
    return null
  }
}

async function getActiveConfig(): Promise<LLMConfig> {
  if (cachedConfig && Date.now() < cachedConfig.expiresAt) {
    return cachedConfig.config
  }

  const dbConfig = await getDBConfig()
  const config = dbConfig || getEnvConfig()

  cachedConfig = {
    config,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }

  return config
}

export function invalidateConfigCache() {
  cachedConfig = null
}

function createSystemPrompt(context: string): string {
  const start = process.env.BOT_ACTIVE_START || '06:00'
  const end = process.env.BOT_ACTIVE_END || '12:00'
  return `Nama Anda adalah Alfredo, asisten AI L1 Support untuk Christian (DevOps Engineer).
Gunakan Bahasa Indonesia korporat yang sangat sopan dan profesional. Sapa pengirim dengan Bapak/Ibu.
Jam aktif bot adalah ${start} hingga ${end} WIB karena Christian sedang istirahat shift malam.

ATURAN MUTLAK (ZERO-HALLUCINATION):
1. Anda HANYA BOLEH menjawab berdasarkan data di dalam konteks yang diberikan di bawah ini.
2. Jika PM menanyakan status server atau project yang TIDAK ADA dalam konteks di bawah, Anda DILARANG menebak atau mengarang jawaban.
3. Jika data TIDAK ADA sama sekali dalam konteks, jawab: "${FALLBACK_REPLY}"

PENTING: Data di bawah ini ADALAH data dari database sistem. Gunakan data ini untuk menjawab pertanyaan.

=== DATA DATABASE ===
${context}
=== AKHIR DATA ===

CONTOH JAWABAN:
Jika konteks berisi "- Server: app-prod-01 | Status: online | Last Ping: 2026-01-01T10:00:00Z"
maka jawab: "Bapak/Ibu, server app-prod-01 saat ini berstatus online. Terakhir diperiksa pada 1 Januari 2026 pukul 10:00 UTC."

Jika konteks berisi "... | Status: failed | Error: Module not found: 'xyz'"
maka jawab: "Bapak/Ibu, pipeline terakhir gagal karena module 'xyz' tidak ditemukan. Saran: jalankan npm install xyz atau cek apakah module sudah didaftarkan di package.json."

Sekarang jawablah pertanyaan PM berdasarkan data di atas.`
}

async function callOpenAICompatible(config: LLMConfig, systemPrompt: string, userMessage: string): Promise<{ content: string | null; debug: { provider: string; status: number; error?: string } }> {
  const debug = { provider: config.provider, status: 0, error: undefined as string | undefined }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.provider === 'ollama') {
    if (config.key) {
      headers['Authorization'] = `Bearer ${config.key}`
    }
  } else {
    headers['Authorization'] = `Bearer ${config.key}`
  }

  const body = config.provider === 'ollama' ? {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    stream: false,
  } : {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.0'),
    max_tokens: 512,
  }

  const response = await fetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  debug.status = response.status

  if (!response.ok) {
    const errorBody = await response.text()
    debug.error = errorBody.substring(0, 300)
    return { content: null, debug }
  }

  const data = await response.json()

  if (config.provider === 'ollama') {
    const content = data?.message?.content || data?.choices?.[0]?.message?.content
    return { content: content || null, debug }
  }

  const content = data?.choices?.[0]?.message?.content
  return { content: content || null, debug }
}

export async function askAlfredo(context: string, userMessage: string): Promise<{ reply: string; debug: { provider: string; hasContext: boolean; contextLength: number; status: number; error?: string } }> {
  const config = await getActiveConfig()
  const debug = {
    provider: config.provider,
    hasContext: !!context.trim(),
    contextLength: context.length,
    status: 0,
    error: undefined as string | undefined,
  }

  if (!context.trim()) {
    return { reply: FALLBACK_REPLY, debug: { ...debug, status: 0, error: 'empty_context' } }
  }

  if (!config.key) {
    console.error(`[LLM] No API key configured for provider: ${config.provider}`)
    return { reply: FALLBACK_REPLY, debug: { ...debug, status: 0, error: 'no_api_key' } }
  }

  try {
    const systemPrompt = createSystemPrompt(context)
    const result = await callOpenAICompatible(config, systemPrompt, userMessage)

    debug.status = result.debug.status
    if (result.debug.error) debug.error = result.debug.error

    if (!result.content) {
      debug.error = debug.error || 'empty_llm_response'
      console.error('[LLM] Empty response from LLM')
    }

    return { reply: result.content || FALLBACK_REPLY, debug }
  } catch (err) {
    console.error('[LLM] Exception:', err)
    return { reply: FALLBACK_REPLY, debug: { ...debug, error: String(err) } }
  }
}

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_DEFAULTS)