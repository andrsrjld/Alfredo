export interface MessagingProvider {
  sendMessage(to: string, text: string): Promise<void>
}

export type MessagingProviderName = 'meta' | 'fonnte' | 'evolution'

export interface IncomingMessage {
  from: string
  text: string
}