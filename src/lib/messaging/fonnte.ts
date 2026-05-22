import { MessagingProvider } from './types'

export class FonnteProvider implements MessagingProvider {
  async sendMessage(to: string, text: string): Promise<void> {
    const token = process.env.FONNTE_API_KEY
    if (!token) {
      console.error('Fonnte provider: missing FONNTE_API_KEY')
      return
    }

    await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: to,
        message: text,
      }),
    })
  }
}