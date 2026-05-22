'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

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
}

const inputClass = "w-full bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    provider: 'deepseek',
    temperature: 0.0,
    models: {},
    gitlab_pat: '',
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
        })
        setExpandedProviders(new Set([data.provider || 'deepseek']))
        setLoading(false)
      })
      .catch(() => {
        const models: Record<string, ModelConfig> = {}
        for (const p of PROVIDERS) {
          models[p.id] = { apiKey: '', model: p.defaultModel, baseUrl: p.defaultUrl }
        }
        setSettings({ provider: 'deepseek', temperature: 0.0, models, gitlab_pat: '', bot_mode: 'normal' })
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
        setSettings(s => ({ ...s, models, gitlab_pat: fresh.gitlab_pat || '', bot_mode: fresh.bot_mode || 'normal' }))
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
    return <div className="p-5 md:p-8"><p className="text-muted-foreground text-xs">Loading...</p></div>
  }

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-2xl">
      <div className="mb-2">
        <p className="text-xs text-muted-foreground/60">Configure AI provider, bot mode, API keys, and GitLab integration</p>
      </div>

      {message && (
        <div className={`text-xs px-3 py-2.5 rounded-sm border ${message.type === 'ok' ? 'border-primary/30 text-primary bg-primary/5' : 'border-destructive/30 text-destructive bg-destructive/5'}`}>
          {message.text}
        </div>
      )}

      <div className="border border-border rounded-md bg-card">
        <div className="px-5 py-3.5 border-b border-border">
          <p className="label-sm text-muted-foreground">Bot Mode</p>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'normal', icon: '🤖', label: 'Normal AI', desc: '03:00–12:00 WIB' },
              { id: 'extended', icon: '🤖', label: 'Extended AI', desc: '24/7 active' },
              { id: 'human', icon: '👤', label: 'Human Mode', desc: 'Bot offline' },
            ] as const).map(mode => (
              <button
                key={mode.id}
                onClick={() => setSettings(s => ({ ...s, bot_mode: mode.id }))}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-md border transition-colors ${settings.bot_mode === mode.id ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background text-muted-foreground hover:border-ring'}`}
              >
                <span className="text-lg">{mode.icon}</span>
                <span className="font-mono text-xs font-medium">{mode.label}</span>
                <span className="text-[10px] text-muted-foreground/60">{mode.desc}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/50 mt-2">
            {settings.bot_mode === 'normal' && 'Alfredo aktif sesuai jam kerja (default).'}
            {settings.bot_mode === 'extended' && 'Alfredo aktif 24 jam. Untuk saat Ijal AFK di luar jam kerja.'}
            {settings.bot_mode === 'human' && 'Alfredo offline. Semua pesan mendapat balasan Ijal sedang online.'}
          </p>
        </div>
      </div>

      <div className="border border-border rounded-md bg-card">
        <div className="px-5 py-3.5 border-b border-border">
          <p className="label-sm text-muted-foreground">Active Provider</p>
        </div>
        <div className="px-5 py-4">
          <select
            value={settings.provider}
            onChange={e => setSettings(s => ({ ...s, provider: e.target.value }))}
            className="w-full md:w-64 bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground focus:border-ring focus:outline-none"
          >
            {PROVIDERS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border border-border rounded-md bg-card">
        <div className="px-5 py-3.5 border-b border-border">
          <p className="label-sm text-muted-foreground">Temperature</p>
        </div>
        <div className="px-5 py-4">
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
            <span className="font-mono text-xs text-muted-foreground w-8">{settings.temperature.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-md bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <p className="label-sm text-muted-foreground">API Keys &amp; Models</p>
        </div>
        <div>
          {PROVIDERS.map(p => {
            const isExpanded = expandedProviders.has(p.id)
            const modelCfg = settings.models[p.id] || { apiKey: '', model: p.defaultModel, baseUrl: p.defaultUrl }
            const isActive = settings.provider === p.id
            return (
              <div key={p.id} className={`border-b border-border last:border-0 ${isActive ? 'bg-primary/[0.03]' : ''}`}>
                <button
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
                  onClick={() => toggleProvider(p.id)}
                >
                  <div className="flex items-center gap-2.5">
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    <span className="font-mono text-xs text-foreground">{p.label}</span>
                    {isActive && <span className="label-sm text-primary">active</span>}
                  </div>
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                {isExpanded && (
                  <div className="px-5 pb-4 space-y-3 bg-muted/10">
                    <div>
                      <label className="label-sm text-muted-foreground/60 mb-1.5 block">API Key</label>
                      <input
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
                        className={inputClass}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="label-sm text-muted-foreground/60 mb-1.5 block">Model</label>
                        <input
                          value={modelCfg.model}
                          onChange={e => setSettings(s => ({
                            ...s,
                            models: { ...s.models, [p.id]: { ...s.models[p.id], model: e.target.value } },
                          }))}
                          className={inputClass}
                        />
                        <p className="text-xs text-muted-foreground/40 mt-1">Available: {p.models}</p>
                      </div>
                      <div>
                        <label className="label-sm text-muted-foreground/60 mb-1.5 block">Base URL</label>
                        <input
                          value={modelCfg.baseUrl}
                          onChange={e => setSettings(s => ({
                            ...s,
                            models: { ...s.models, [p.id]: { ...s.models[p.id], baseUrl: e.target.value } },
                          }))}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="border border-border rounded-md bg-card">
        <div className="px-5 py-3.5 border-b border-border">
          <p className="label-sm text-muted-foreground">GitLab Integration</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground/60">Used to fetch pipeline error logs for AI analysis. Scope required: <span className="font-mono text-foreground">api</span></p>
          <div>
            <label className="label-sm text-muted-foreground/60 mb-1.5 block">Personal Access Token</label>
            <input
              type="password"
              placeholder={settings.gitlab_pat ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'glpat-xxxxxxxxxxxx'}
              value={settings.gitlab_pat.includes('\u2022') ? settings.gitlab_pat : ''}
              onChange={e => setSettings(s => ({ ...s, gitlab_pat: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2.5 rounded-sm font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}