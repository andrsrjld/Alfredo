import { MessagingProvider } from './types'

export class MetaProvider implements MessagingProvider {
  async sendMessage(to: string, text: string): Promise<void> {
    const phoneId = process.env.WA_PHONE_NUMBER_ID
    const token = process.env.WA_ACCESS_TOKEN
    if (!phoneId || !token) {
      console.error('Meta provider: missing WA_PHONE_NUMBER_ID or WA_ACCESS_TOKEN')
      return
    }

    await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        text: { body: text },
      }),
    })
  }
}