'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
    return name || phone
  }

  const filtered = logs.filter(
    (l) => {
      const name = nameMap.get(l.pm_number) || ''
      const q = search.toLowerCase()
      return l.pm_number.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        l.pm_message.toLowerCase().includes(q) ||
        l.bot_reply.toLowerCase().includes(q)
    }
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function expandAll() {
    setExpanded(new Set(paged.map(l => l.id)))
  }

  function collapseAll() {
    setExpanded(new Set())
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 lg:p-6 xl:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
        <p className="text-sm text-muted-foreground">WhatsApp conversation history.</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} className="gap-2">
            <ChevronsUpDown className="h-3 w-3" /> Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} className="text-muted-foreground">
            Collapse All
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 md:flex-none md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-8"
          />
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1 font-mono text-sm text-muted-foreground">
            <Button variant="outline" size="xs" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
            <span className="px-2">{page + 1}/{totalPages}</span>
            <Button variant="outline" size="xs" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {paged.map((log) => {
          const isOpen = expanded.has(log.id)
          const needsExpand = log.bot_reply.length > TRUNCATE_LEN || log.pm_message.length > TRUNCATE_LEN
          const displayName = getDisplayName(log.pm_number)
          return (
            <Card key={log.id} size="sm">
              <CardContent>
                <button
                  className="-m-4 flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50"
                  onClick={() => needsExpand && toggle(log.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{displayName}</span>
                      {log.is_group && (
                        <Badge variant="secondary">Group</Badge>
                      )}
                      <span className="ml-auto whitespace-nowrap font-mono text-xs text-muted-foreground">{formatWIB(log.created_at)}</span>
                    </div>
                    <p className="truncate text-sm text-foreground">{log.pm_message}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      🤖 {isOpen || !needsExpand ? '' : `${log.bot_reply.slice(0, TRUNCATE_LEN)}…`}
                    </p>
                  </div>
                  {needsExpand && (
                    <span className="shrink-0 mt-1">
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </span>
                  )}
                </button>
              </CardContent>
              {isOpen && needsExpand && (
                <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                  <div>
                    <p className="label-sm mb-1">Message</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">{log.pm_message}</p>
                  </div>
                  <div>
                    <p className="label-sm mb-1">Bot Reply</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">{log.bot_reply}</p>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                    <span>{formatWIB(log.created_at)}</span>
                    {log.is_group && <span>Group chat</span>}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
        {paged.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No logs found.</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
          <span className="font-mono text-sm text-muted-foreground">
            Page {page + 1} of {totalPages} ({filtered.length} logs)
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
        </div>
      )}
    </div>
  )
}
