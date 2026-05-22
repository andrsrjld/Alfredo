const FALLBACK_REPLY =
  'Mohon maaf Bapak/Ibu, status yang Bapak/Ibu tanyakan tidak tercatat dalam log serah terima sistem kami. Christian akan melakukan pengecekan manual dan merespons setelah pukul 12.00.'

function createSystemPrompt(context: string): string {
  const start = process.env.BOT_ACTIVE_START || '06:00'
  const end = process.env.BOT_ACTIVE_END || '12:00'
  return `Nama Anda adalah Alfredo, asisten AI L1 Support untuk Christian (DevOps Engineer).
Gunakan Bahasa Indonesia korporat yang sangat sopan dan profesional. Sapa pengirim dengan Bapak/Ibu.
Jam aktif bot adalah ${start} hingga ${end} WIB karena Christian sedang istirahat shift malam.

ATURAN MUTLAK (ZERO-HALLUCINATION):
1. Anda HANYA BOLEH menjawab berdasarkan data di dalam blok [CONTEXT_DATABASE] di bawah ini.
2. Jika PM menanyakan status server atau project yang TIDAK ADA dalam [CONTEXT_DATABASE], Anda DILARANG KERAS menebak, berasumsi, atau mengarang jawaban.
3. Jika data tidak ditemukan, jawab: "${FALLBACK_REPLY}"

[CONTEXT_DATABASE]
${context}`
}

interface LLMConfig {
  url: string
  key: string
  model: string
}

function getLLMConfig(): LLMConfig {
  const provider = process.env.AI_PROVIDER || 'groq'

  switch (provider) {
    case 'deepseek':
      return {
        url: 'https://api.deepseek.com/v1/chat/completions',
        key: process.env.DEEPSEEK_API_KEY || '',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      }
    case 'groq':
    default:
      return {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_API_KEY || '',
        model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
      }
  }
}

export async function askAlfredo(context: string, userMessage: string): Promise<{ reply: string; debug: { provider: string; hasContext: boolean; contextLength: number; status: number; error?: string } }> {
  const config = getLLMConfig()
  const debug = {
    provider: process.env.AI_PROVIDER || 'groq',
    hasContext: !!context.trim(),
    contextLength: context.length,
    status: 0,
    error: undefined as string | undefined,
  }

  if (!context.trim()) {
    return { reply: FALLBACK_REPLY, debug: { ...debug, status: 0, error: 'empty_context' } }
  }

  if (!config.key) {
    console.error(`[LLM] No API key configured for provider: ${process.env.AI_PROVIDER || 'groq'}`)
    return { reply: FALLBACK_REPLY, debug: { ...debug, status: 0, error: 'no_api_key' } }
  }

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: createSystemPrompt(context) },
          { role: 'user', content: userMessage },
        ],
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.0'),
        max_tokens: 512,
      }),
    })

    debug.status = response.status

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[LLM] API error ${response.status}: ${errorBody}`)
      debug.error = errorBody.substring(0, 200)
      return { reply: FALLBACK_REPLY, debug }
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content

    if (!content) {
      debug.error = 'empty_llm_response'
      console.error('[LLM] Empty response from LLM:', JSON.stringify(data).substring(0, 300))
    }

    return { reply: content || FALLBACK_REPLY, debug }
  } catch (err) {
    console.error('[LLM] Exception:', err)
    debug.error = String(err)
    return { reply: FALLBACK_REPLY, debug }
  }
}