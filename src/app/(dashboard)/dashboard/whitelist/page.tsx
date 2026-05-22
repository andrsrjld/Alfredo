'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

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
    return <div className="p-6"><p className="text-muted-foreground">Loading whitelist...</p></div>
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">WhatsApp Whitelist</h1>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.type === 'ok' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add PM to Whitelist</CardTitle>
          <CardDescription>
            Phone numbers are automatically normalized to international format (62xxx) without +.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Phone Number</label>
              <Input
                placeholder="e.g. 081234567890 or 628123456789"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
              />
              {preview && (
                <p className="text-xs text-muted-foreground mt-1">Normalized: {preview}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">PM Name (optional)</label>
              <Input
                placeholder="e.g. Budi Santoso"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={!newPhone}>Add to Whitelist</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Whitelisted PMs ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>PM Name</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow key={entry.phone_number}>
                    <TableCell className="font-mono">{entry.phone_number}</TableCell>
                    <TableCell>{entry.pm_name || '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(entry.phone_number)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No whitelisted PMs yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}