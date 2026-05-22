import { MessagingProvider, SendMessageOptions } from './types'

export class FonnteProvider implements MessagingProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendMessage(to: string, text: string, _options?: SendMessageOptions): Promise<void> {
    const token = process.env.FONNTE_API_KEY
    if (!token) {
      console.error('Fonnte provider: missing FONNTE_API_KEY')
      return
    }

    const body: Record<string, unknown> = {
      target: to,
      message: text,
    }

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[Fonnte] send failed:', res.status, errText)
    }
  }
}