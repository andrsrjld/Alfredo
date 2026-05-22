import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

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

export async function askAlfredo(context: string, userMessage: string): Promise<string> {
  if (!context.trim()) {
    return FALLBACK_REPLY
  }

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: createSystemPrompt(context) },
      { role: 'user', content: userMessage },
    ],
    model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.0'),
    max_tokens: 512,
  })

  return (
    chatCompletion.choices[0]?.message?.content ||
    FALLBACK_REPLY
  )
}
