'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const PROVIDERS = [
  { id: 'deepseek', label: 'DeepSeek', models: 'deepseek-chat, deepseek-reasoner', defaultModel: 'deepseek-chat', defaultUrl: 'https://api.deepseek.com/v1/chat/completions' },
  { id: 'openai', label: 'OpenAI', models: 'gpt-4o-mini, gpt-4o, gpt-4.1-mini, gpt-4.1', defaultModel: 'gpt-4o-mini', defaultUrl: 'https://api.openai.com/v1/chat/completions' },
  { id: 'gemini', label: 'Google Gemini', models: 'gemini-2.0-flash, gemini-2.5-flash, gemini-2.5-pro', defaultModel: 'gemini-2.0-flash', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' },
  { id: 'ollama', label: 'Ollama Cloud', models: 'deepseek-v4-flash, gemma4, qwen3.5, glm-5.1, etc.', defaultModel: 'deepseek-v4-flash', defaultUrl: 'https://ollama.com/api/chat' },
] as const

type ModelConfig = {
  apiKey: string
  model: string
  baseUrl: string
}

type Settings = {
  provider: string
  temperature: number
  models: Record<string, ModelConfig>
  gitlab_pat: string
  bot_mode: string
  active_start: string
  active_end: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    provider: 'deepseek',
    temperature: 0.0,
    models: {},
    gitlab_pat: '',
    bot_mode: 'normal',
    active_start: '03:00',
    active_end: '12:00',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set(['deepseek']))

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        const models: Record<string, ModelConfig> = {}
        for (const p of PROVIDERS) {
          const existing = data.models?.[p.id]
          models[p.id] = {
            apiKey: existing?.apiKey || '',
            model: existing?.model || p.defaultModel,
            baseUrl: existing?.baseUrl || p.defaultUrl,
          }
        }
        setSettings({
          provider: data.provider || 'deepseek',
          temperature: data.temperature ?? 0.0,
          models,
          gitlab_pat: data.gitlab_pat || '',
          bot_mode: data.bot_mode || 'normal',
          active_start: data.active_start || '03:00',
          active_end: data.active_end || '12:00',
        })
        setExpandedProviders(new Set([data.provider || 'deepseek']))
        setLoading(false)
      })
      .catch(() => {
        const models: Record<string, ModelConfig> = {}
        for (const p of PROVIDERS) {
          models[p.id] = { apiKey: '', model: p.defaultModel, baseUrl: p.defaultUrl }
        }
        setSettings({ provider: 'deepseek', temperature: 0.0, models, gitlab_pat: '', bot_mode: 'normal', active_start: '03:00', active_end: '12:00' })
        setLoading(false)
      })
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage({ type: 'ok', text: 'Settings saved.' })
        const fresh = await fetch('/api/settings').then(r => r.json())
        const models: Record<string, ModelConfig> = {}
        for (const p of PROVIDERS) {
          const existing = fresh.models?.[p.id]
          models[p.id] = {
            apiKey: existing?.apiKey || '',
            model: settings.models[p.id].model,
            baseUrl: settings.models[p.id].baseUrl,
          }
        }
        setSettings(s => ({ ...s, models, gitlab_pat: fresh.gitlab_pat || '', bot_mode: fresh.bot_mode || 'normal', active_start: fresh.active_start || '03:00', active_end: fresh.active_end || '12:00' }))
      } else {
        setMessage({ type: 'err', text: data.error || 'Failed to save.' })
      }
    } catch {
      setMessage({ type: 'err', text: 'Network error.' })
    }
    setSaving(false)
  }

  function toggleProvider(id: string) {
    setExpandedProviders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return <div className="p-4 lg:p-6 xl:p-8"><p className="text-sm text-muted-foreground">Loading...</p></div>
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 lg:p-6 xl:p-8">
      <div className="mb-2">
        <p className="text-sm text-muted-foreground">Configure AI provider, bot mode, API keys, and GitLab integration.</p>
      </div>

      {message && (
        <div className={`rounded-md border px-3 py-2 text-sm ${message.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader><CardDescription>Bot Mode</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {([
              { id: 'normal', icon: '🤖', label: 'Normal AI', desc: `${settings.active_start}–${settings.active_end} WIB` },
              { id: 'extended', icon: '🤖', label: 'Extended AI', desc: '24/7 active' },
              { id: 'human', icon: '👤', label: 'Human Mode', desc: 'Bot offline' },
            ] as const).map(mode => (
              <Button
                key={mode.id}
                variant={settings.bot_mode === mode.id ? 'default' : 'outline'}
                size="sm"
                className="h-auto flex-col items-center gap-1 py-4"
                onClick={() => setSettings(s => ({ ...s, bot_mode: mode.id }))}
              >
                <span className="text-lg">{mode.icon}</span>
                <span className="text-sm font-medium">{mode.label}</span>
                <span className="text-xs font-normal opacity-70">{mode.desc}</span>
              </Button>
            ))}
          </div>
          {settings.bot_mode === 'normal' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="label-sm shrink-0">Active hours</label>
              <Input
                type="time"
                value={settings.active_start}
                onChange={e => setSettings(s => ({ ...s, active_start: e.target.value }))}
                className="w-32 font-mono"
              />
              <span className="text-sm text-muted-foreground">—</span>
              <Input
                type="time"
                value={settings.active_end}
                onChange={e => setSettings(s => ({ ...s, active_end: e.target.value }))}
                className="w-32 font-mono"
              />
              <span className="text-sm text-muted-foreground">WIB</span>
            </div>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {settings.bot_mode === 'normal' && 'Alfredo aktif sesuai jam kerja (default).'}
            {settings.bot_mode === 'extended' && 'Alfredo aktif 24 jam. Untuk saat Ijal AFK di luar jam kerja.'}
            {settings.bot_mode === 'human' && 'Alfredo offline. Semua pesan mendapat balasan Ijal sedang online.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardDescription>Active Provider</CardDescription></CardHeader>
        <CardContent>
          <select
            value={settings.provider}
            onChange={e => setSettings(s => ({ ...s, provider: e.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:w-72"
          >
            {PROVIDERS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardDescription>Temperature</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={settings.temperature}
              onChange={e => setSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
              className="w-48 accent-primary"
            />
            <span className="w-8 font-mono text-sm text-muted-foreground">{settings.temperature.toFixed(1)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardDescription>API Keys & Models</CardDescription></CardHeader>
        <CardContent className="p-0">
          {PROVIDERS.map(p => {
            const isExpanded = expandedProviders.has(p.id)
            const modelCfg = settings.models[p.id] || { apiKey: '', model: p.defaultModel, baseUrl: p.defaultUrl }
            const isActive = settings.provider === p.id
            return (
              <div key={p.id} className={`border-b border-border last:border-0 ${isActive ? 'bg-primary/[0.03]' : ''}`}>
                <button
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/50"
                  onClick={() => toggleProvider(p.id)}
                >
                  <div className="flex items-center gap-2.5">
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    <span className="text-sm font-medium text-foreground">{p.label}</span>
                    {isActive && <span className="label-sm text-primary">active</span>}
                  </div>
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                {isExpanded && (
                  <div className="space-y-4 bg-muted/30 px-5 pb-5 pt-1">
                    <div>
                      <label className="label-sm mb-2 block">API Key</label>
                      <Input
                        type="password"
                        placeholder={modelCfg.apiKey ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'Enter API key'}
                        value={modelCfg.apiKey.includes('\u2022') ? modelCfg.apiKey : ''}
                        onChange={e => {
                          const val = e.target.value
                          setSettings(s => ({
                            ...s,
                            models: { ...s.models, [p.id]: { ...s.models[p.id], apiKey: val } },
                          }))
                        }}
                        className="font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="label-sm mb-2 block">Model</label>
                        <Input
                          value={modelCfg.model}
                          onChange={e => setSettings(s => ({
                            ...s,
                            models: { ...s.models, [p.id]: { ...s.models[p.id], model: e.target.value } },
                          }))}
                          className="font-mono"
                        />
                        <p className="mt-1.5 text-xs text-muted-foreground">Available: {p.models}</p>
                      </div>
                      <div>
                        <label className="label-sm mb-2 block">Base URL</label>
                        <Input
                          value={modelCfg.baseUrl}
                          onChange={e => setSettings(s => ({
                            ...s,
                            models: { ...s.models, [p.id]: { ...s.models[p.id], baseUrl: e.target.value } },
                          }))}
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardDescription>GitLab Integration</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Used to fetch pipeline error logs for AI analysis. Scope required: <span className="font-mono text-foreground">api</span></p>
          <div>
            <label className="label-sm mb-2 block">Personal Access Token</label>
            <Input
              type="password"
              placeholder={settings.gitlab_pat ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'glpat-xxxxxxxxxxxx'}
              value={settings.gitlab_pat.includes('\u2022') ? settings.gitlab_pat : ''}
              onChange={e => setSettings(s => ({ ...s, gitlab_pat: e.target.value }))}
              className="font-mono"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  )
}
