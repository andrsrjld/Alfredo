'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import ServerCard from '@/components/servers/ServerCard'
import ServerDetailDialog from '@/components/servers/ServerDetailDialog'
import { SERVER_PUBLIC_SELECT, type ServerRecord } from '@/lib/servers'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MOBILE_PAGE_SIZE = 4
const DESKTOP_PAGE_SIZE = 8

function ArrowPagination({ page, total, onPrev, onNext }: {
  page: number
  total: number
  onPrev: () => void
  onNext: () => void
}) {
  if (total <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 pt-1">
      <Button variant="outline" size="icon-sm" aria-label="Previous server page" disabled={page === 0} onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span className="min-w-[3rem] text-center text-xs text-muted-foreground">{page + 1} / {total}</span>
      <Button variant="outline" size="icon-sm" aria-label="Next server page" disabled={page >= total - 1} onClick={onNext}>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

export default function RealtimeServerStatus() {
  const [servers, setServers] = useState<ServerRecord[]>([])
  const [mobilePage, setMobilePage] = useState(0)
  const [desktopPage, setDesktopPage] = useState(0)
  const [selectedServer, setSelectedServer] = useState<ServerRecord | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    async function fetchServers() {
      const { data } = await supabase.from('server_status').select(SERVER_PUBLIC_SELECT).order('server_name', { ascending: true })
      if (data) {
        setServers(prev => {
          const next = data as ServerRecord[]
          const map = new Map(next.map(s => [s.id, s]))
          const merged = prev.map(s => map.get(s.id) || s)
          const existingIds = new Set(prev.map(s => s.id))
          const added = next.filter(s => !existingIds.has(s.id))
          return [...merged, ...added]
        })
      }
    }
    fetchServers()
    const interval = setInterval(fetchServers, 2000)
    const dbChannel = supabase
      .channel('server_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_status' }, () => {
        fetchServers()
      })
      .subscribe()
    return () => {
      clearInterval(interval)
      supabase.removeChannel(dbChannel)
    }
  }, [])

  function handleServerUpdated(updated: ServerRecord) {
    setServers(prev => prev.map(s => (s.id === updated.id ? updated : s)))
    setSelectedServer(updated)
  }

  const mobileTotalPages = Math.max(1, Math.ceil(servers.length / MOBILE_PAGE_SIZE))
  const desktopTotalPages = Math.max(1, Math.ceil(servers.length / DESKTOP_PAGE_SIZE))
  const desktopItems = servers.slice(desktopPage * DESKTOP_PAGE_SIZE, (desktopPage + 1) * DESKTOP_PAGE_SIZE)

  return (
    <div className="space-y-3">
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth md:hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        ref={scrollRef}
      >
        {Array.from({ length: mobileTotalPages }).map((_, pageIdx) => {
          const pageItems = servers.slice(pageIdx * MOBILE_PAGE_SIZE, (pageIdx + 1) * MOBILE_PAGE_SIZE)
          return (
            <div key={pageIdx} className="grid grid-cols-2 gap-3 snap-start min-w-full shrink-0">
              {pageItems.map(s => (
                <ServerCard key={s.id} server={s} variant="compact" onClick={() => setSelectedServer(s)} />
              ))}
            </div>
          )
        })}
        {servers.length === 0 && (
          <p className="w-full py-6 text-center text-sm text-muted-foreground">No servers reporting.</p>
        )}
      </div>
      {mobileTotalPages > 1 && (
        <div className="md:hidden">
          <ArrowPagination
            page={mobilePage}
            total={mobileTotalPages}
            onPrev={() => {
              const p = Math.max(0, mobilePage - 1)
              setMobilePage(p)
              scrollRef.current?.scrollTo({ left: p * (scrollRef.current?.offsetWidth || 0), behavior: 'smooth' })
            }}
            onNext={() => {
              const p = Math.min(mobileTotalPages - 1, mobilePage + 1)
              setMobilePage(p)
              scrollRef.current?.scrollTo({ left: p * (scrollRef.current?.offsetWidth || 0), behavior: 'smooth' })
            }}
          />
        </div>
      )}

      <div className="hidden md:block">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {desktopItems.map(s => (
            <ServerCard key={s.id} server={s} onClick={() => setSelectedServer(s)} />
          ))}
        </div>
        {servers.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No servers reporting.</p>
        )}
      </div>
      {desktopTotalPages > 1 && (
        <div className="hidden md:block">
          <ArrowPagination
            page={desktopPage}
            total={desktopTotalPages}
            onPrev={() => setDesktopPage(p => Math.max(0, p - 1))}
            onNext={() => setDesktopPage(p => Math.min(desktopTotalPages - 1, p + 1))}
          />
        </div>
      )}

      <ServerDetailDialog
        serverId={selectedServer?.id ?? null}
        initialServer={selectedServer}
        open={!!selectedServer}
        onOpenChange={(open) => { if (!open) setSelectedServer(null) }}
        editable
        onServerUpdated={handleServerUpdated}
      />
    </div>
  )
}
