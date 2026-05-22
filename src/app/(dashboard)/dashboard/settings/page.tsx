'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

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
        setMessage({ type: 'ok', text: 'Settings saved successfully.' })
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
        setMessage({ type: 'err', text: data.error || 'Failed to save settings.' })
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
    return <div className="p-6"><p className="text-muted-foreground">Loading settings...</p></div>
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">AI Settings</h1>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.type === 'ok' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active Provider</CardTitle>
          <CardDescription>Select which AI provider Alfredo uses for generating replies.</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={settings.provider}
            onChange={e => setSettings(s => ({ ...s, provider: e.target.value }))}
            className="w-full md:w-64 border border-input bg-background rounded-md px-3 py-2 text-sm"
          >
            {PROVIDERS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Temperature</CardTitle>
          <CardDescription>Lower values = more deterministic. 0.0 is recommended for zero-hallucination.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={settings.temperature}
              onChange={e => setSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
              className="w-48"
            />
            <span className="text-sm font-mono w-10">{settings.temperature.toFixed(1)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider API Keys &amp; Models</CardTitle>
          <CardDescription>Configure credentials for each provider. Masked keys are shown after save — re-enter to change.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PROVIDERS.map(p => {
            const isExpanded = expandedProviders.has(p.id)
            const modelCfg = settings.models[p.id] || { apiKey: '', model: p.defaultModel, baseUrl: p.defaultUrl }
            const isActive = settings.provider === p.id
            return (
              <div key={p.id} className={`border rounded-md ${isActive ? 'border-primary' : 'border-border'}`}>
                <button
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  onClick={() => toggleProvider(p.id)}
                >
                  <span className="font-medium text-sm">
                    {p.label}
                    {isActive && <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">Active</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                </button>
                {isExpanded && (
                  <div className="p-3 pt-0 space-y-3 border-t">
                    <div>
                      <label className="text-xs text-muted-foreground">API Key</label>
                      <Input
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
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Model</label>
                      <Input
                        value={modelCfg.model}
                        onChange={e => setSettings(s => ({
                          ...s,
                          models: { ...s.models, [p.id]: { ...s.models[p.id], model: e.target.value } },
                        }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Base URL</label>
                      <Input
                        value={modelCfg.baseUrl}
                        onChange={e => setSettings(s => ({
                          ...s,
                          models: { ...s.models, [p.id]: { ...s.models[p.id], baseUrl: e.target.value } },
                        }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  )
}