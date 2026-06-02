import type { CapacitorConfig } from '@capacitor/cli'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const config: CapacitorConfig = {
  appId: process.env.NEXT_PUBLIC_ANDROID_APP_ID || 'com.alfredo.devops',
  appName: 'Alfredo',
  webDir: 'public',
  server: {
    url: appUrl,
    cleartext: appUrl.startsWith('http://'),
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
