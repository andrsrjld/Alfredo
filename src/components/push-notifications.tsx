'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

export default function PushNotificationRegistrar() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let active = true

    async function register() {
      const permission = await PushNotifications.requestPermissions()
      if (!active || permission.receive !== 'granted') return

      await PushNotifications.register()
      await PushNotifications.addListener('registration', async token => {
        await fetch('/api/push/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcm_token: token.value, app_version: '1.0.1' }),
        }).catch(() => undefined)
      })
      await PushNotifications.addListener('registrationError', error => {
        console.error('[push] registration error', error)
      })
    }

    register().catch(error => console.error('[push] setup failed', error))

    return () => {
      active = false
      PushNotifications.removeAllListeners().catch(() => undefined)
    }
  }, [])

  return null
}
