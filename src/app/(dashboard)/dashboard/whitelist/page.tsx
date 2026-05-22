'use client'

import { useEffect, useState } from 'react'
import { X, Upload } from 'lucide-react'
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

const PAGE_SIZE = 10

function normalizePhoneLocal(input: string): string {
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
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    fetchWhitelist()
  }, [])

  async function fetchWhitelist() {
    try {
      const res = await fetch('/api/whitelist')
      const data = await res.json()
      if (Array.isArray(data)) setEntries(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (newPhone) {
      setPreview(normalizePhoneLocal(newPhone))
    } else {
      setPreview('')
    }
  }, [newPhone])

  const totalPages = Math.ceil(entries.length / PAGE_SIZE)
  const paged = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

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

  async function handleImport() {
    if (!importText.trim()) return
    setImporting(true)
    const lines = importText.trim().split('\n').filter(l => l.trim())
    const entries_import: Array<{ phone: string; name?: string }> = []

    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim())
      const phone = parts[0]
      const name = parts[1] || undefined
      if (phone) entries_import.push({ phone, name })
    }

    try {
      const res = await fetch('/api/whitelist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entries_import }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'ok', text: `Imported ${data.imported} contacts${data.skipped ? `, ${data.skipped} skipped` : ''}${data.errors ? `, ${data.errors.length} errors` : ''}` })
        setImportText('')
        setImportOpen(false)
        await fetchWhitelist()
        setPage(0)
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
    return <div className="p-4 lg:p-6 xl:p-8"><p className="text-sm text-muted-foreground">Loading...</p></div>
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 lg:p-6 xl:p-8">
      <div className="mb-2">
        <p className="text-sm text-muted-foreground">Manage PM phone numbers allowed to chat with Alfredo.</p>
      </div>

      {message && (
        <div className={`rounded-md border px-3 py-2 text-sm ${message.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>Add PM</CardDescription>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
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
                    placeholder={`628123456789, WIT Fahmi Sholat\n6282240274833, WIT Ganjar\n6285794005069`}
                    rows={6}
                    className="font-mono"
                  />
                  <div className="flex items-center gap-3">
                    <Button onClick={handleImport} disabled={importing || !importText.trim()}>
                      {importing ? 'Importing...' : 'Import'}
                    </Button>
                    <Button variant="ghost" onClick={() => { setImportOpen(false); setImportText('') }}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label-sm mb-2 block">Phone Number</label>
              <Input
                placeholder="e.g. 081234567890"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                className="font-mono"
              />
              {preview && (
                <p className="mt-1.5 font-mono text-xs text-muted-foreground">→ {preview}</p>
              )}
            </div>
            <div>
              <label className="label-sm mb-2 block">Name</label>
              <Input
                placeholder="e.g. Budi Santoso"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newPhone}>
            Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Whitelisted PMs ({entries.length})</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            {paged.map(entry => (
              <div key={entry.phone_number} className="flex items-center justify-between border-b border-border py-3 transition-colors last:border-0 hover:bg-muted/50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-sm text-foreground">{entry.phone_number}</span>
                  {entry.pm_name && <span className="truncate text-sm text-muted-foreground">{entry.pm_name}</span>}
                </div>
                <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(entry.phone_number)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {entries.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No whitelisted PMs yet.</p>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-3 border-t border-border/50 mt-3">
              <Button variant="outline" size="xs" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
              <span className="font-mono text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="xs" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
