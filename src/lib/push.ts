import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { createAdminClient } from '@/lib/supabase/admin'

type NotifyEvent = {
  eventType: string
  target: string
  dedupeKey: string
  title: string
  body: string
}

function getFirebaseReady(): boolean {
  return !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
}

function getFirebaseMessaging() {
  if (!getFirebaseReady()) return null
  const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n')
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    })
  }
  return getMessaging()
}

export function timeBucketKey(prefix: string, target: string, minutes: number): string {
  const bucket = Math.floor(Date.now() / (minutes * 60_000))
  return `${prefix}:${target}:${bucket}`
}

export async function sendPushNotification(event: NotifyEvent): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { data: existing } = await supabase
      .from('notification_events')
      .select('id')
      .eq('dedupe_key', event.dedupeKey)
      .maybeSingle()
    if (existing) return

    const { data: devices, error: deviceError } = await supabase
      .from('push_devices')
      .select('fcm_token')
      .eq('platform', 'android')
    if (deviceError) {
      console.error('[push] device query failed:', deviceError)
      return
    }

    const tokens = (devices || []).map(device => device.fcm_token).filter(Boolean)
    if (tokens.length === 0) return

    const messaging = getFirebaseMessaging()
    if (!messaging) {
      console.warn('[push] Firebase env not configured; skipping push send')
      return
    }

    await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: event.title,
        body: event.body,
      },
      data: {
        event_type: event.eventType,
        target: event.target,
      },
    })

    await supabase.from('notification_events').insert({
      dedupe_key: event.dedupeKey,
      event_type: event.eventType,
      target: event.target,
      status: 'sent',
    })
  } catch (err) {
    console.error('[push] send failed:', err)
  }
}
