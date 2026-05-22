'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

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

const TRUNCATE_LEN = 80

function formatWIB(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ChatLog[]>([])
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

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
    <div className="p-5 md:p-8 space-y-4 max-w-[1280px]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
        <p className="text-xs text-muted-foreground/60">WhatsApp conversation history</p>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="flex items-center gap-1 font-mono text-xs text-primary hover:text-primary/80 transition-colors">
            <ChevronsUpDown className="h-3 w-3" /> Expand All
          </button>
          <span className="text-muted-foreground/30">|</span>
          <button onClick={collapseAll} className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
            Collapse All
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 md:flex-none md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="w-full bg-card border border-border rounded-sm pl-8 pr-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
          />
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 border border-border rounded hover:bg-muted/50 disabled:opacity-30"
            >Prev</button>
            <span className="px-2">{page + 1}/{totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 border border-border rounded hover:bg-muted/50 disabled:opacity-30"
            >Next</button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {paged.map((log) => {
          const isOpen = expanded.has(log.id)
          const needsExpand = log.bot_reply.length > TRUNCATE_LEN || log.pm_message.length > TRUNCATE_LEN
          const displayName = getDisplayName(log.pm_number)
          return (
            <div key={log.id} className="border border-border/60 rounded-md bg-card">
              <button
                className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-muted/20 transition-colors"
                onClick={() => needsExpand && toggle(log.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-foreground">{displayName}</span>
                    {log.is_group && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">group</span>
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground/50 ml-auto whitespace-nowrap">{formatWIB(log.created_at)}</span>
                  </div>
                  <p className="text-xs text-foreground truncate">{log.pm_message}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    🤖 {isOpen || !needsExpand ? '' : `${log.bot_reply.slice(0, TRUNCATE_LEN)}…`}
                  </p>
                </div>
                {needsExpand && (
                  <span className="shrink-0 mt-1">
                    {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </span>
                )}
              </button>
              {isOpen && needsExpand && (
                <div className="px-4 pb-3 space-y-2 border-t border-border/40 pt-2">
                  <div>
                    <p className="label-sm text-muted-foreground/60 mb-1">Message</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap break-words">{log.pm_message}</p>
                  </div>
                  <div>
                    <p className="label-sm text-muted-foreground/60 mb-1">Bot Reply</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap break-words">{log.bot_reply}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/40 font-mono">
                    <span>{formatWIB(log.created_at)}</span>
                    {log.is_group && <span>Group chat</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {paged.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">No logs found.</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs font-mono border border-border rounded hover:bg-muted/50 disabled:opacity-30"
          >Prev</button>
          <span className="text-xs font-mono text-muted-foreground">
            Page {page + 1} of {totalPages} ({filtered.length} logs)
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-xs font-mono border border-border rounded hover:bg-muted/50 disabled:opacity-30"
          >Next</button>
        </div>
      )}
    </div>
  )
}