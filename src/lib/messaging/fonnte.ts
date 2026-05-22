import { MessagingProvider, SendMessageOptions } from './types'

export class FonnteProvider implements MessagingProvider {
  async sendMessage(to: string, text: string, options?: SendMessageOptions): Promise<void> {
    const token = process.env.FONNTE_API_KEY
    if (!token) {
      console.error('Fonnte provider: missing FONNTE_API_KEY')
      return
    }

    const body: Record<string, unknown> = {
      target: to,
      message: text,
    }

    if (options?.isGroup) {
      body.group = true
    }

    await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }
}