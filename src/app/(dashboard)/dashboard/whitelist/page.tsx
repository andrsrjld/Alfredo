'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'

type WhitelistEntry = {
  phone_number: string
  pm_name: string | null
}

function normalizePhone(input: string): string {
  let num = input.replace(/[\s\-()+]/g, '')
  if (num.startsWith('08')) num = '628' + num.slice(2)
  else if (num.startsWith('8')) num = '628' + num
  else if (num.startsWith('+62')) num = num.slice(1)
  else if (num.startsWith('62')) num = num
  else num = '62' + num
  return num
}

export default function WhitelistPage() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [newPhone, setNewPhone] = useState('')
  const [newName, setNewName] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [preview, setPreview] = useState('')

  useEffect(() => {
    fetch('/api/whitelist')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setEntries(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (newPhone) {
      setPreview(normalizePhone(newPhone))
    } else {
      setPreview('')
    }
  }, [newPhone])

  async function handleAdd() {
    if (!newPhone) return
    const phone = normalizePhone(newPhone)
    try {
      const res = await fetch('/api/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, pm_name: newName || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setEntries(prev => {
          const filtered = prev.filter(e => e.phone_number !== phone)
          return [...filtered, data].sort((a, b) => (a.pm_name || '').localeCompare(b.pm_name || ''))
        })
        setNewPhone('')
        setNewName('')
        setPreview('')
        setMessage({ type: 'ok', text: `Added ${phone}` })
      } else {
        setMessage({ type: 'err', text: data.error || 'Failed to add' })
      }
    } catch {
      setMessage({ type: 'err', text: 'Network error' })
    }
  }

  async function handleDelete(phone_number: string) {
    try {
      const res = await fetch(`/api/whitelist?phone_number=${encodeURIComponent(phone_number)}`, { method: 'DELETE' })
      if (res.ok) {
        setEntries(prev => prev.filter(e => e.phone_number !== phone_number))
        setMessage({ type: 'ok', text: `Removed ${phone_number}` })
      } else {
        const data = await res.json()
        setMessage({ type: 'err', text: data.error || 'Failed to delete' })
      }
    } catch {
      setMessage({ type: 'err', text: 'Network error' })
    }
  }

  if (loading) {
    return <div className="p-5 md:p-8"><p className="text-muted-foreground text-xs">Loading...</p></div>
  }

  const inputClass = "w-full bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-2xl">
      <div className="mb-2">
        <p className="text-xs text-muted-foreground/60">Manage PM phone numbers allowed to chat with Alfredo</p>
      </div>

      {message && (
        <div className={`text-xs px-3 py-2.5 rounded-sm border ${message.type === 'ok' ? 'border-primary/30 text-primary bg-primary/5' : 'border-destructive/30 text-destructive bg-destructive/5'}`}>
          {message.text}
        </div>
      )}

      <div className="border border-border rounded-md bg-card">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="label-sm text-muted-foreground">Add PM</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label-sm text-muted-foreground/60 mb-1.5 block">Phone Number</label>
              <input
                placeholder="e.g. 081234567890"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                className={inputClass}
              />
              {preview && (
                <p className="font-mono text-xs text-muted-foreground mt-1.5">→ {preview}</p>
              )}
            </div>
            <div>
              <label className="label-sm text-muted-foreground/60 mb-1.5 block">Name</label>
              <input
                placeholder="e.g. Budi Santoso"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!newPhone}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-sm font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className="border border-border rounded-md bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <p className="label-sm text-muted-foreground">Whitelisted PMs ({entries.length})</p>
        </div>
        <div>
          {entries.map(entry => (
            <div key={entry.phone_number} className="flex items-center justify-between px-5 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs text-foreground">{entry.phone_number}</span>
                {entry.pm_name && <span className="text-xs text-muted-foreground truncate">{entry.pm_name}</span>}
              </div>
              <button
                onClick={() => handleDelete(entry.phone_number)}
                className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground py-8 text-center">No whitelisted PMs yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}