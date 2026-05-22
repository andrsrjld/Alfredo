'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Project = {
  id: string
  repo_name: string
  project_group: string | null
  branch: string | null
  commit_msg: string | null
  status: string
  error_detail: string | null
  last_updated: string
}

const MOBILE_PAGE_SIZE = 4
const DESKTOP_PAGE_SIZE = 10

function capitalizeWords(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

const statusConfig: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'success' | 'warning'; label: string }> = {
  success: { variant: 'success', label: 'Success' },
  failed: { variant: 'destructive', label: 'Failed' },
  running: { variant: 'warning', label: 'Running' },
  canceled: { variant: 'secondary', label: 'Canceled' },
  pending: { variant: 'secondary', label: 'Pending' },
  skipped: { variant: 'secondary', label: 'Skipped' },
  manual: { variant: 'secondary', label: 'Manual' },
  created: { variant: 'secondary', label: 'Created' },
}

function formatWIBShort(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function ProjectCard({ project, expandedError, toggleError }: {
  project: Project
  expandedError: Set<string>
  toggleError: (id: string) => void
}) {
  const cfg = statusConfig[project.status] || { variant: 'secondary' as const, label: capitalizeWords(project.status) }
  const isOpen = expandedError.has(project.id)
  return (
    <Card size="sm" className="h-full">
      <CardContent>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs font-medium text-foreground sm:text-sm">{capitalizeWords(project.repo_name)}</span>
          <Badge variant={cfg.variant} className="shrink-0">{cfg.label}</Badge>
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:gap-1.5 sm:text-sm">
          <div className="flex items-center justify-between">
            <span>Group</span>
            <span className="ml-1 max-w-[80px] truncate">{project.project_group || '\u2014'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Branch</span>
            <span className="ml-1 truncate">{project.branch || '\u2014'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Updated</span>
            <span className="font-mono">{formatWIBShort(project.last_updated)}</span>
          </div>
        </div>
        {project.error_detail && (
          <Button
            variant="link"
            size="xs"
            className="mt-1.5 text-destructive"
            onClick={() => toggleError(project.id)}
          >
            {isOpen ? 'Hide' : 'Error'}
          </Button>
        )}
        {isOpen && project.error_detail && (
          <pre className="mt-2 whitespace-pre-wrap break-words border-t border-border pt-2 font-mono text-xs text-foreground">{project.error_detail}</pre>
        )}
      </CardContent>
    </Card>
  )
}

export default function RealtimeProjectStatus() {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [expandedError, setExpandedError] = useState<Set<string>>(new Set())

  const scrollRef = useRef<HTMLDivElement>(null)
  const [mobilePage, setMobilePage] = useState(0)
  const [desktopPage, setDesktopPage] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    async function fetchProjects() {
      const { data } = await supabase.from('project_status').select('*').order('last_updated', { ascending: false })
      if (data) setProjects(data)
    }
    fetchProjects()

    const channel = supabase
      .channel('project_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_status' }, () => {
        fetchProjects()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const filtered = projects.filter(
    (p) =>
      p.repo_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.project_group || '').toLowerCase().includes(search.toLowerCase())
  )

  const mobileTotalPages = Math.ceil(filtered.length / MOBILE_PAGE_SIZE)
  const desktopTotalPages = Math.ceil(filtered.length / DESKTOP_PAGE_SIZE)
  const desktopItems = filtered.slice(desktopPage * DESKTOP_PAGE_SIZE, (desktopPage + 1) * DESKTOP_PAGE_SIZE)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const page = Math.round(el.scrollLeft / el.offsetWidth)
    setMobilePage(page)
  }, [])

  function toggleError(id: string) {
    setExpandedError(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 md:flex-none md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            type="text"
            placeholder="Search project or group..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setDesktopPage(0) }}
            className="pl-8"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} projects</span>
      </div>

      {/* Mobile: horizontal slider */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth md:hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex"
      >
        {Array.from({ length: mobileTotalPages }).map((_, pageIdx) => {
          const pageItems = filtered.slice(pageIdx * MOBILE_PAGE_SIZE, (pageIdx + 1) * MOBILE_PAGE_SIZE)
          return (
            <div key={pageIdx} className="grid grid-cols-2 gap-3 snap-start" style={{ minWidth: '100%', flexShrink: 0 }}>
              {pageItems.map((project) => (
                <ProjectCard key={project.id} project={project} expandedError={expandedError} toggleError={toggleError} />
              ))}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No projects found.</p>
        )}
      </div>
      {renderDots(mobileTotalPages, mobilePage, (i) => {
        setMobilePage(i)
        scrollRef.current?.scrollTo({ left: i * scrollRef.current.offsetWidth, behavior: 'smooth' })
      })}

      {/* Desktop: paginated card grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {desktopItems.map((project) => (
            <ProjectCard key={project.id} project={project} expandedError={expandedError} toggleError={toggleError} />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No projects found.</p>
        )}
      </div>
      {renderDots(desktopTotalPages, desktopPage, setDesktopPage)}
    </div>
  )
}