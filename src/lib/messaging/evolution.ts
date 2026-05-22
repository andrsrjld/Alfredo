import { MessagingProvider, SendMessageOptions } from './types'

export class EvolutionProvider implements MessagingProvider {
  async sendMessage(to: string, text: string, options?: SendMessageOptions): Promise<void> {
    const baseUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY
    const instance = process.env.EVOLUTION_INSTANCE_NAME

    if (!baseUrl || !apiKey || !instance) {
      console.error('Evolution provider: missing EVOLUTION_API_URL, EVOLUTION_API_KEY, or EVOLUTION_INSTANCE_NAME')
      return
    }

    const body: Record<string, unknown> = {
      number: to,
      textMessage: { text },
    }

    if (options?.mentions && options.mentions.length > 0) {
      body.mentions = options.mentions
    }

    await fetch(`${baseUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }
}