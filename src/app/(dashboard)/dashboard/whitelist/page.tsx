'use client'

import { useEffect, useState, useMemo } from 'react'
import { X, Upload, Phone, User, Search } from 'lucide-react'
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

type WhitelistEntry = {
  phone_number: string
  pm_name: string | null
}

const PAGE_SIZE = 20

function normalizePhoneLocal(input: string): string {
  let num = input.replace(/[\s\-()+]/g, '')
  if (num.startsWith('08')) num = '628' + num.slice(2)
  else if (num.startsWith('8')) num = '628' + num
  else if (num.startsWith('+62')) num = num.slice(1)
  else if (num.startsWith('62')) num = num
  else num = '62' + num
  return num
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatPhoneDisplay(phone: string): string {
  if (phone.startsWith('62') && phone.length >= 10) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 5)}-${phone.slice(5, 9)}-${phone.slice(9)}`
  }
  return phone
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
  'bg-pink-100 text-pink-700',
]

function getAvatarColor(phone: string): string {
  let hash = 0
  for (let i = 0; i < phone.length; i++) hash = phone.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function WhitelistPage() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [newPhone, setNewPhone] = useState('')
  const [newName, setNewName] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [preview, setPreview] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => { fetchWhitelist() }, [])

  async function fetchWhitelist() {
    try {
      const res = await fetch('/api/whitelist')
      const data = await res.json()
      if (Array.isArray(data)) setEntries(data)
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPreview(newPhone ? normalizePhoneLocal(newPhone) : '')
  }, [newPhone])

  const filtered = useMemo(() => {
    if (!search) return entries
    const q = search.toLowerCase()
    return entries.filter(e =>
      e.phone_number.toLowerCase().includes(q) ||
      (e.pm_name || '').toLowerCase().includes(q)
    )
  }, [entries, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const [page, setPage] = useState(0)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => { setPage(0) }, [search])

  async function handleAdd() {
    if (!newPhone) return
    const phone = normalizePhoneLocal(newPhone)
    try {
      const res = await fetch('/api/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, pm_name: newName || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        await fetchWhitelist()
        setNewPhone('')
        setNewName('')
        setPreview('')
        setMessage({ type: 'ok', text: `Added ${phone}` })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'err', text: data.error || 'Failed to add' })
      }
    } catch {
      setMessage({ type: 'err', text: 'Network error' })
    }
  }

  async function handleDelete(phone_number: string) {
    setDeleting(phone_number)
    try {
      const res = await fetch(`/api/whitelist?phone_number=${encodeURIComponent(phone_number)}`, { method: 'DELETE' })
      if (res.ok) {
        setEntries(prev => prev.filter(e => e.phone_number !== phone_number))
        setMessage({ type: 'ok', text: `Removed` })
        setTimeout(() => setMessage(null), 3000)
      } else {
        const data = await res.json()
        setMessage({ type: 'err', text: data.error || 'Failed to delete' })
      }
    } catch {
      setMessage({ type: 'err', text: 'Network error' })
    } finally {
      setDeleting(null)
    }
  }

  async function handleImport() {
    if (!importText.trim()) return
    setImporting(true)
    const entries_import: Array<{ phone: string; name?: string }> = []
    for (const line of importText.trim().split('\n').filter(l => l.trim())) {
      const parts = line.split(',').map(s => s.trim())
      if (parts[0]) entries_import.push({ phone: parts[0], name: parts[1] || undefined })
    }
    try {
      const res = await fetch('/api/whitelist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entries_import }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'ok', text: `Imported ${data.imported}${data.skipped ? `, ${data.skipped} skipped` : ''}` })
        setImportText('')
        setImportOpen(false)
        await fetchWhitelist()
        setTimeout(() => setMessage(null), 4000)
      } else {
        setMessage({ type: 'err', text: data.error || 'Import failed' })
      }
    } catch {
      setMessage({ type: 'err', text: 'Network error' })
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return <div className="p-4 md:p-6"><p className="text-xs text-muted-foreground">Loading...</p></div>
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-4 md:p-6">
      {message && (
        <div className={`rounded-md border px-3 py-1.5 text-xs ${message.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardDescription>Add Contact</CardDescription>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger render={<Button variant="outline" size="xs" className="gap-1.5" />}>
                <Upload className="h-3 w-3" /> Import
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Contacts</DialogTitle>
                  <DialogDescription>One entry per line: phone, name or just phone</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder={`628123456789, WIT Fahmi\n6282240274833, WIT Ganjar\n6285794005069`}
                    rows={6}
                    className="font-mono text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleImport} disabled={importing || !importText.trim()}>
                      {importing ? 'Importing...' : 'Import'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setImportOpen(false); setImportText('') }}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                <Input
                  placeholder="081234567890"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  className="pl-7 h-8 font-mono text-xs"
                />
              </div>
              {preview && <p className="mt-1 font-mono text-[10px] text-muted-foreground">→ {preview}</p>}
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Name</label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                <Input
                  placeholder="Budi Santoso"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="pl-7 h-8 text-xs"
                />
              </div>
            </div>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newPhone} className="w-full sm:w-auto">Add Contact</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardDescription>Contacts ({filtered.length})</CardDescription>
            <div className="relative w-full max-w-[10rem] sm:max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
              <Input
                placeholder="Filter..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-6 h-7 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {paged.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {search ? 'No matches.' : 'No contacts yet.'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {paged.map(entry => (
                <div
                  key={entry.phone_number}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 group"
                >
                  <div className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${getAvatarColor(entry.phone_number)}`}>
                    {getInitials(entry.pm_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    {entry.pm_name && (
                      <p className="truncate text-xs font-medium text-foreground">{entry.pm_name}</p>
                    )}
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{formatPhoneDisplay(entry.phone_number)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDelete(entry.phone_number)}
                    disabled={deleting === entry.phone_number}
                    className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-border px-4 py-2">
              <Button variant="outline" size="xs" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
              <span className="font-mono text-[10px] text-muted-foreground">{page + 1}/{totalPages}</span>
              <Button variant="outline" size="xs" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}