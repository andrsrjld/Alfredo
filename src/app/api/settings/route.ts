import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt, maskKey } from '@/lib/encryption'
import { invalidateConfigCache } from '@/lib/llm'

const SUPPORTED_PROVIDERS = ['deepseek', 'openai', 'gemini', 'ollama']
const noStore = { headers: { 'Cache-Control': 'no-store' } }

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_config')
      .single()

    if (error || !data) {
      return NextResponse.json({ provider: 'deepseek', temperature: 0.0, models: {}, gitlab_pat: '' }, noStore)
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
      gitlab_pat: (raw.gitlab_pat as string) ? maskKey(raw.gitlab_pat as string) : '',
    }, noStore)
  } catch (err) {
    console.error('[Settings GET]', err)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500, ...noStore })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, temperature, models, gitlab_pat } = body as {
      provider: string
      temperature: number
      models: Record<string, Record<string, string>>
      gitlab_pat?: string
    }

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400, ...noStore })
    }

    const clampedTemp = Math.max(0, Math.min(1, temperature ?? 0.0))

    const supabase = createAdminClient()
    const { data: existing } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_config')
      .single()

    const existingModels = existing
      ? ((existing.value as Record<string, unknown>).models || {}) as Record<string, Record<string, string>>
      : {}
    const existingGitlabPat = existing
      ? (existing.value as Record<string, unknown>).gitlab_pat as string | undefined
      : undefined

    const encryptedModels: Record<string, Record<string, string>> = {}
    for (const [prov, cfg] of Object.entries(models)) {
      encryptedModels[prov] = { ...cfg }
      if (cfg.apiKey && !cfg.apiKey.includes('\u2022')) {
        try {
          encryptedModels[prov].apiKey = encrypt(cfg.apiKey)
        } catch {
          return NextResponse.json({ error: 'ENCRYPTION_KEY not set. Cannot save API keys.' }, { status: 500, ...noStore })
        }
      } else if (cfg.apiKey && cfg.apiKey.includes('\u2022')) {
        encryptedModels[prov].apiKey = existingModels[prov]?.apiKey || ''
      } else {
        encryptedModels[prov].apiKey = ''
      }
    }

    let encryptedGitlabPat: string | undefined = existingGitlabPat
    if (gitlab_pat && !gitlab_pat.includes('\u2022')) {
      try {
        encryptedGitlabPat = encrypt(gitlab_pat)
      } catch {
        return NextResponse.json({ error: 'ENCRYPTION_KEY not set. Cannot save GitLab PAT.' }, { status: 500, ...noStore })
      }
    } else if (gitlab_pat === '') {
      encryptedGitlabPat = ''
    }

    const value: Record<string, unknown> = {
      provider,
      temperature: clampedTemp,
      models: encryptedModels,
    }
    if (encryptedGitlabPat !== undefined) {
      value.gitlab_pat = encryptedGitlabPat
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'ai_config', value }, { onConflict: 'key' })

    console.error('[Settings PUT] upsert result:', { error, value: JSON.stringify(value).length })

    if (error) {
      console.error('[Settings PUT] DB error:', error)
      return NextResponse.json({ error: 'Failed to save settings', detail: error.message }, { status: 500, ...noStore })
    }

    invalidateConfigCache()
    revalidatePath('/api/settings')

    return NextResponse.json({ ok: true }, noStore)
  } catch (err) {
    console.error('[Settings PUT]', err)
    return NextResponse.json({ error: 'Failed to save settings', detail: String(err) }, { status: 500, ...noStore })
  }
}