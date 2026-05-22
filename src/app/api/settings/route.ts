import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt, maskKey } from '@/lib/encryption'
import { invalidateConfigCache } from '@/lib/llm'

const SUPPORTED_PROVIDERS = ['deepseek', 'openai', 'gemini', 'ollama']

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_config')
      .single()

    if (error || !data) {
      return NextResponse.json({ provider: 'deepseek', temperature: 0.0, models: {} })
    }

    const raw = data.value as Record<string, unknown>
    const models = (raw.models || {}) as Record<string, Record<string, string>>

    const maskedModels: Record<string, Record<string, string>> = {}
    for (const [provider, cfg] of Object.entries(models)) {
      maskedModels[provider] = {
        ...cfg,
        apiKey: cfg.apiKey ? maskKey(cfg.apiKey) : '',
      }
    }

    return NextResponse.json({
      provider: raw.provider || 'deepseek',
      temperature: raw.temperature ?? 0.0,
      models: maskedModels,
    })
  } catch (err) {
    console.error('[Settings GET]', err)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, temperature, models } = body as {
      provider: string
      temperature: number
      models: Record<string, Record<string, string>>
    }

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 })
    }

    const clampedTemp = Math.max(0, Math.min(1, temperature ?? 0.0))

    const encryptedModels: Record<string, Record<string, string>> = {}
    for (const [prov, cfg] of Object.entries(models)) {
      encryptedModels[prov] = { ...cfg }
      if (cfg.apiKey && !cfg.apiKey.includes('••••')) {
        encryptedModels[prov].apiKey = encrypt(cfg.apiKey)
      } else if (cfg.apiKey && cfg.apiKey.includes('••••')) {
        const supabase = createAdminClient()
        const { data: existing } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'ai_config')
          .single()

        if (existing) {
          const raw = existing.value as Record<string, unknown>
          const existingModels = (raw.models || {}) as Record<string, Record<string, string>>
          encryptedModels[prov].apiKey = existingModels[prov]?.apiKey || ''
        }
      } else {
        encryptedModels[prov].apiKey = ''
      }
    }

    const value = {
      provider,
      temperature: clampedTemp,
      models: encryptedModels,
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'ai_config', value }, { onConflict: 'key' })

    if (error) {
      console.error('[Settings PUT] DB error:', error)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }

    invalidateConfigCache()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Settings PUT]', err)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}