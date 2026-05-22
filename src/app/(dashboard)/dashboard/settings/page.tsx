'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

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

const inputClass = "w-full bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"

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
        setExpandedProviders(new Set([data.provider || 'deepseek']))
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
    return <div className="p-5 md:p-8"><p className="text-muted-foreground text-xs">Loading...</p></div>
  }

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-2xl">
      <div className="mb-2">
        <p className="text-xs text-muted-foreground/60">Configure AI provider, model, and API keys</p>
      </div>

      {message && (
        <div className={`text-xs px-3 py-2.5 rounded-sm border ${message.type === 'ok' ? 'border-primary/30 text-primary bg-primary/5' : 'border-destructive/30 text-destructive bg-destructive/5'}`}>
          {message.text}
        </div>
      )}

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
                        placeholder={modelCfg.apiKey ? '••••••••' : 'Enter API key'}
                        value={modelCfg.apiKey.includes('••••') ? modelCfg.apiKey : ''}
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