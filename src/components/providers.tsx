'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import PushNotificationRegistrar from './push-notifications'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <PushNotificationRegistrar />
      {children}
    </NextThemesProvider>
  )
}
