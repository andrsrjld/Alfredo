'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { maskPhone, redactContent } from '@/lib/censor'

type ChatLog = {
  id: string
  pm_number: string
  pm_message: string
  bot_reply: string
  created_at: string
  is_group: boolean | null
  group_id: string | null
}

type WhitelistEntry = {
  phone_number: string
  pm_name: string | null
}

const PAGE_SIZE = 10
const TRUNCATE_LEN = 80

function formatWIB(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatWIBShort(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ChatLog[]>([])
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    async function fetchLogs() {
      const { data, error } = await supabase
        .from('chat_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (!error && data) setLogs(data)
    }
    async function fetchWhitelist() {
      const { data } = await supabase.from('whitelisted_pms').select('phone_number, pm_name')
      if (data) setWhitelist(data)
    }
    fetchLogs()
    fetchWhitelist()
  }, [])

  const nameMap = new Map<string, string | null>()
  for (const w of whitelist) {
    nameMap.set(w.phone_number, w.pm_name)
  }

  function getDisplayName(phone: string): string {
    const name = nameMap.get(phone)
    if (name) return name
    return maskPhone(phone)
  }

  const filtered = logs.filter(l => {
    const name = nameMap.get(l.pm_number) || ''
    const q = search.toLowerCase()
    return l.pm_number.toLowerCase().includes(q) ||
      name.toLowerCase().includes(q) ||
      l.pm_message.toLowerCase().includes(q) ||
      l.bot_reply.toLowerCase().includes(q)
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-tight">Chat Logs</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">WhatsApp conversation history</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs" onClick={() => setExpanded(new Set(paged.map(l => l.id)))}>Expand All</Button>
          <Button variant="ghost" size="xs" onClick={() => setExpanded(new Set())} className="text-muted-foreground">Collapse All</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 sm:max-w-xs md:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" aria-hidden="true" />
          <label htmlFor="logs-search" className="sr-only">Search chat logs</label>
          <Input
            id="logs-search"
            name="logs_search"
            type="text"
            placeholder="Search…"
            autoComplete="off"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="pl-7 h-8 text-xs"
          />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground font-mono">{filtered.length}</span>
      </div>

      <div className="space-y-2">
        {paged.map(log => {
          const isOpen = expanded.has(log.id)
          const needsExpand = log.bot_reply.length > TRUNCATE_LEN || log.pm_message.length > TRUNCATE_LEN
          const displayName = getDisplayName(log.pm_number)
          const censoredMsg = redactContent(log.pm_message)
          const censoredReply = redactContent(log.bot_reply)
          return (
            <Card key={log.id} size="sm" className="bg-background/60">
              <CardContent className="p-0">
                <button
                  className="flex w-full items-start gap-2 p-3 text-left transition-colors hover:bg-muted/50"
                  onClick={() => needsExpand && toggle(log.id)}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-foreground sm:text-sm">{displayName}</span>
                      {log.is_group && <Badge variant="secondary" className="text-[10px] shrink-0">Group</Badge>}
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground sm:text-xs">{formatWIBShort(log.created_at)}</span>
                    </div>
                    <p className="truncate text-xs text-foreground sm:text-sm">{censoredMsg}</p>
                    <p className="truncate text-xs text-muted-foreground sm:text-sm">
                      🤖 {isOpen || !needsExpand ? censoredReply : `${censoredReply.slice(0, TRUNCATE_LEN)}…`}
                    </p>
                  </div>
                  {needsExpand && (
                    <span className="shrink-0 mt-0.5">
                      {isOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" aria-hidden="true" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
                    </span>
                  )}
                </button>
              </CardContent>
              {isOpen && needsExpand && (
                <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground">Message</span>
                    <p className="whitespace-pre-wrap break-words text-xs text-foreground sm:text-sm">{censoredMsg}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground">Bot Reply</span>
                    <p className="whitespace-pre-wrap break-words text-xs text-foreground sm:text-sm">{censoredReply}</p>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                    <span>{formatWIB(log.created_at)}</span>
                    {log.is_group && <span>Group</span>}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
        {paged.length === 0 && (
          <div className="py-8 text-center text-xs sm:text-sm text-muted-foreground">No logs found.</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button variant="outline" size="xs" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
          <span className="font-mono text-xs text-muted-foreground">{page + 1}/{totalPages}</span>
          <Button variant="outline" size="xs" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
        </div>
      )}
    </div>
  )
}
