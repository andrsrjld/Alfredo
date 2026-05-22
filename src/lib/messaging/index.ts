import { MessagingProvider, MessagingProviderName } from './types'
import { MetaProvider } from './meta'
import { FonnteProvider } from './fonnte'
import { EvolutionProvider } from './evolution'

const providers: Record<MessagingProviderName, () => MessagingProvider> = {
  meta: () => new MetaProvider(),
  fonnte: () => new FonnteProvider(),
  evolution: () => new EvolutionProvider(),
}

export function getMessagingProvider(): MessagingProvider {
  const name = (process.env.WA_PROVIDER || 'meta') as MessagingProviderName
  const factory = providers[name]
  if (!factory) {
    console.warn(`Unknown WA_PROVIDER "${name}", falling back to meta`)
    return new MetaProvider()
  }
  return factory()
}