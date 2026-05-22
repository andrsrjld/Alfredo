'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

type Server = {
  id: string
  server_name: string
  ip_address: string | null
  status: string
  notes: string | null
  ping_secret: string | null
  last_ping: string
}

const MOBILE_PAGE_SIZE = 4
const DESKTOP_PAGE_SIZE = 8

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://alfredo-pi.vercel.app'

const statusConfig: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'success' | 'warning'; label: string }> = {
  online: { variant: 'success', label: 'Online' },
  offline: { variant: 'destructive', label: 'Offline' },
  high_load: { variant: 'warning', label: 'High load' },
}

function formatWIB(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function ServerDetailDialog({ server, open, onOpenChange }: {
  server: Server | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [copied, setCopied] = useState<string | null>(null)

  if (!server) return null
  const cfg = statusConfig[server.status] || { variant: 'secondary' as const, label: server.status }
  const pingUrl = server.ping_secret ? `${APP_URL}/api/server-ping?secret=${server.ping_secret}` : null

  async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2 pr-8">
            <span className="min-w-0 break-words font-mono">{server.server_name}</span>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </DialogTitle>
          <DialogDescription>Server details</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <DetailRow label="IP Address" value={server.ip_address} mono />
          <DetailRow label="Notes" value={server.notes} />
          <DetailRow label="Last Ping" value={formatWIB(server.last_ping)} mono />
          {server.ping_secret && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Ping Secret</span>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <code className="min-w-0 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-xs">{server.ping_secret}</code>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => copyToClipboard(server.ping_secret!, 'secret')}
                >
                  {copied === 'secret' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}
          {pingUrl && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Ping URL</span>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <code className="min-w-0 whitespace-normal break-all rounded bg-muted px-2 py-1 font-mono text-xs">{pingUrl}</code>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => copyToClipboard(pingUrl, 'url')}
                >
                  {copied === 'url' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start sm:gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={`min-w-0 break-words text-xs sm:text-right ${mono ? 'font-mono' : ''}`}>{value || '\u2014'}</span>
    </div>
  )
}

export default function RealtimeServerStatus() {
  const [servers, setServers] = useState<Server[]>([])
  const [mobilePage, setMobilePage] = useState(0)
  const [desktopPage, setDesktopPage] = useState(0)
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function fetchServers() {
      const { data } = await supabase.from('server_status').select('*').order('last_ping', { ascending: false })
      if (data) setServers(data)
    }
    fetchServers()

    const channel = supabase
      .channel('server_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_status' }, () => {
        fetchServers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const mobileTotalPages = Math.ceil(servers.length / MOBILE_PAGE_SIZE)
  const desktopTotalPages = Math.ceil(servers.length / DESKTOP_PAGE_SIZE)
  const desktopItems = servers.slice(desktopPage * DESKTOP_PAGE_SIZE, (desktopPage + 1) * DESKTOP_PAGE_SIZE)

  function renderCard(server: Server, compact?: boolean) {
    const cfg = statusConfig[server.status] || { variant: 'secondary' as const, label: server.status }
    return (
      <Card key={server.id} size="sm" className="h-full cursor-pointer" onClick={() => setSelectedServer(server)}>
        <CardContent>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={`truncate font-mono font-medium text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{server.server_name}</span>
            <Badge variant={cfg.variant} className="shrink-0">{cfg.label}</Badge>
          </div>
          <div className={`flex flex-col gap-1 text-muted-foreground ${compact ? 'text-xs' : 'text-sm gap-1.5'}`}>
            <div className="flex items-center justify-between">
              <span>IP</span>
              <span className="font-mono truncate ml-2">{server.ip_address || '\u2014'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ping</span>
              <span className="font-mono" title={formatWIB(server.last_ping)}>{timeAgo(server.last_ping)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  function renderDots(total: number, current: number, onChange: (i: number) => void) {
    if (total <= 1) return null
    return (
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-foreground' : 'w-1.5 bg-muted-foreground/30'}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Mobile: slider */}
      <div
        className="snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth md:hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex"
        ref={(el) => {
          if (!el) return
          el.onscroll = () => {
            setMobilePage(Math.round(el.scrollLeft / el.offsetWidth))
          }
        }}
      >
        {Array.from({ length: mobileTotalPages }).map((_, pageIdx) => {
          const pageItems = servers.slice(pageIdx * MOBILE_PAGE_SIZE, (pageIdx + 1) * MOBILE_PAGE_SIZE)
          return (
            <div key={pageIdx} className="grid grid-cols-2 gap-3 snap-start" style={{ minWidth: '100%', flexShrink: 0 }}>
              {pageItems.map(s => renderCard(s, true))}
            </div>
          )
        })}
        {servers.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No servers reporting.</p>
        )}
      </div>
      {renderDots(mobileTotalPages, mobilePage, (i) => {
        setMobilePage(i)
        const el = document.querySelector('[data-server-scroll]') as HTMLDivElement
        el?.scrollTo({ left: i * el.offsetWidth, behavior: 'smooth' })
      })}

      {/* Desktop: paginated grid */}
      <div className="hidden md:block" data-server-scroll>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {desktopItems.map(s => renderCard(s))}
        </div>
        {servers.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No servers reporting.</p>
        )}
      </div>
      {renderDots(desktopTotalPages, desktopPage, setDesktopPage)}

      <ServerDetailDialog
        server={selectedServer}
        open={!!selectedServer}
        onOpenChange={(open) => { if (!open) setSelectedServer(null) }}
      />
    </div>
  )
}
