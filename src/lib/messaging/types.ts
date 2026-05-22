export interface MessagingProvider {
  sendMessage(to: string, text: string, options?: SendMessageOptions): Promise<void>
}

export type MessagingProviderName = 'meta' | 'fonnte' | 'evolution'

export interface IncomingMessage {
  from: string
  text: string
  isGroup: boolean
  groupId?: string
  senderName?: string
}

export interface SendMessageOptions {
  isGroup?: boolean
  mentions?: string[]
}