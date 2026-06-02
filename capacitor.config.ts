import type { CapacitorConfig } from '@capacitor/cli'

const DEFAULT_APP_URL = 'https://alfredo-wit-indonesia.vercel.app'
const appUrl = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL

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
