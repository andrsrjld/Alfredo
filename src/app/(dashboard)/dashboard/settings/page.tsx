'use client'

import { useEffect, useState } from 'react'

const PROVIDERS = [
  { id: 'deepseek', label: 'DeepSeek', defaultModel: 'deepseek-chat', defaultUrl: 'https://api.deepseek.com/v1/chat/completions' },
  { id: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o-mini', defaultUrl: 'https://api.openai.com/v1/chat/completions' },
  { id: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.0-flash', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' },
  { id: 'ollama', label: 'Ollama Cloud', defaultModel: 'deepseek-v4-flash', defaultUrl: 'https://ollama.com/api/chat' },
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
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    provider: 'deepseek',
    temperature: 0.0,
    models: {},
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
        setSettings({ provider: data.provider || 'deepseek', temperature: data.temperature ?? 0.0, models })
        setLoading(false)
      })
      .catch(() => {
        const models: Record<string, ModelConfig> = {}
        for (const p of PROVIDERS) {
          models[p.id] = { apiKey: '', model: p.defaultModel, baseUrl: p.defaultUrl }
        }
        setSettings({ provider: 'deepseek', temperature: 0.0, models })
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
        setSettings(s => ({ ...s, models }))
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
    return <div className="p-5 md:p-lg"><p className="text-muted-foreground text-xs">Loading...</p></div>
  }

  return (
    <div className="p-5 md:p-lg space-y-md max-w-2xl">
      <p className="label-sm text-muted-foreground">AI Settings</p>

      {message && (
        <div className={`label-sm px-3 py-2 rounded-sm border ${message.type === 'ok' ? 'border-primary/30 text-primary' : 'border-destructive/30 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <div className="border border-border rounded-md p-4 bg-card">
        <p className="label-sm text-muted-foreground mb-3">Active Provider</p>
        <select
          value={settings.provider}
          onChange={e => setSettings(s => ({ ...s, provider: e.target.value }))}
          className="w-full md:w-64 bg-background border border-border rounded-sm px-3 py-1.5 font-mono text-xs text-foreground focus:border-ring focus:outline-none"
        >
          {PROVIDERS.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="border border-border rounded-md p-4 bg-card">
        <p className="label-sm text-muted-foreground mb-3">Temperature</p>
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
          <span className="font-mono text-xs w-8">{settings.temperature.toFixed(1)}</span>
        </div>
      </div>

      <div className="border border-border rounded-md p-4 bg-card">
        <p className="label-sm text-muted-foreground mb-4">Provider API Keys &amp; Models</p>
        <div className="space-y-2">
          {PROVIDERS.map(p => {
            const isExpanded = expandedProviders.has(p.id)
            const modelCfg = settings.models[p.id] || { apiKey: '', model: p.defaultModel, baseUrl: p.defaultUrl }
            const isActive = settings.provider === p.id
            return (
              <div key={p.id} className={`border rounded-sm ${isActive ? 'border-primary/40' : 'border-border'}`}>
                <button
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  onClick={() => toggleProvider(p.id)}
                >
                  <span className="font-mono text-xs">
                    {p.label}
                    {isActive && <span className="ml-2 text-primary">●</span>}
                  </span>
                  <span className="text-muted-foreground text-xs">{isExpanded ? '▲' : '▼'}</span>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/50">
                    <div>
                      <label className="label-sm text-muted-foreground mb-1 block">API Key</label>
                      <input
                        type="password"
                        placeholder={modelCfg.apiKey ? '••••••••' : 'Enter API key'}
                        value={modelCfg.apiKey.includes('••••') ? modelCfg.apiKey : ''}
                        onChange={e => {
                          const val = e.target.value
                          setSettings(s => ({
                            ...s,
                            models: {
                              ...s.models,
                              [p.id]: { ...s.models[p.id], apiKey: val },
                            },
                          }))
                        }}
                        className="w-full bg-background border border-border rounded-sm px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="label-sm text-muted-foreground mb-1 block">Model</label>
                      <input
                        value={modelCfg.model}
                        onChange={e => setSettings(s => ({
                          ...s,
                          models: { ...s.models, [p.id]: { ...s.models[p.id], model: e.target.value } },
                        }))}
                        className="w-full bg-background border border-border rounded-sm px-3 py-1.5 font-mono text-xs text-foreground focus:border-ring focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="label-sm text-muted-foreground mb-1 block">Base URL</label>
                      <input
                        value={modelCfg.baseUrl}
                        onChange={e => setSettings(s => ({
                          ...s,
                          models: { ...s.models, [p.id]: { ...s.models[p.id], baseUrl: e.target.value } },
                        }))}
                        className="w-full bg-background border border-border rounded-sm px-3 py-1.5 font-mono text-xs text-foreground focus:border-ring focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-sm font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}