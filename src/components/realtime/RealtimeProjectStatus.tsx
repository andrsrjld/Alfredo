'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ExternalLink, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

type Project = {
  id: string
  repo_name: string
  project_group: string | null
  branch: string | null
  commit_msg: string | null
  status: string
  error_detail: string | null
  pipeline_id: string | null
  gitlab_project_id: string | null
  gitlab_event_time: string | null
  last_updated: string
}

const MOBILE_PAGE_SIZE = 4
const DESKTOP_PAGE_SIZE = 9

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

function DetailRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start sm:gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={`min-w-0 break-words text-xs sm:text-right ${mono ? 'font-mono' : ''}`}>{value || '\u2014'}</span>
    </div>
  )
}

function ProjectDetailDialog({ project, open, onOpenChange }: {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [showError, setShowError] = useState(false)
  const [copiedError, setCopiedError] = useState(false)

  if (!project) return null
  const cfg = statusConfig[project.status] || { variant: 'secondary' as const, label: capitalizeWords(project.status) }

  const repoPath = project.project_group
    ? `${project.project_group}/${project.repo_name}`
    : project.repo_name
  const pipelineUrl = project.pipeline_id
    ? `https://gitlab.com/${repoPath}/-/pipelines/${project.pipeline_id}`
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-y-auto max-h-[calc(100dvh-1rem)]">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2 pr-8">
            <span className="min-w-0 break-words font-mono">{capitalizeWords(project.repo_name)}</span>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </DialogTitle>
          <DialogDescription>Pipeline details</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <DetailRow label="Project Group" value={project.project_group} />
          <DetailRow label="Branch" value={project.branch} mono />
          <DetailRow label="Commit" value={project.commit_msg} />
          <DetailRow label="Pipeline ID" value={project.pipeline_id} mono />
          <DetailRow label="GitLab Project ID" value={project.gitlab_project_id} mono />
          <DetailRow label="Event Time" value={project.gitlab_event_time ? formatWIB(project.gitlab_event_time) : null} mono />
          <DetailRow label="Last Updated" value={formatWIB(project.last_updated)} mono />

          {project.pipeline_id && (
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => window.open(pipelineUrl!, '_blank', 'noopener')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View in GitLab
              </Button>
            </div>
          )}

          {project.error_detail && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="link"
                  size="xs"
                  className="text-destructive p-0"
                  onClick={() => setShowError(!showError)}
                >
                  {showError ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                  {showError ? 'Hide Error' : 'Show Error'}
                </Button>
                <Button
                  variant="link"
                  size="xs"
                  className="text-muted-foreground p-0"
                  onClick={() => { navigator.clipboard.writeText(project.error_detail!); setCopiedError(true); setTimeout(() => setCopiedError(false), 2000) }}
                >
                  {copiedError ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              {showError && (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted px-3 py-2 font-mono text-xs text-foreground">{project.error_detail}</pre>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ProjectCard({ project, onClick }: {
  project: Project
  onClick: () => void
}) {
  const cfg = statusConfig[project.status] || { variant: 'secondary' as const, label: capitalizeWords(project.status) }
  return (
    <Card size="sm" className="h-full cursor-pointer" onClick={onClick}>
      <CardContent>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs font-medium text-foreground sm:text-sm">{capitalizeWords(project.repo_name)}</span>
          <Badge variant={cfg.variant} className="shrink-0">{cfg.label}</Badge>
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:gap-1.5 sm:text-sm">
          <div className="flex items-center justify-between">
            <span>Group</span>
            <span className="ml-1 truncate max-w-[5rem] sm:max-w-none">{project.project_group || '\u2014'}</span>
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
      </CardContent>
    </Card>
  )
}

function ArrowPagination({ page, total, onPrev, onNext }: {
  page: number
  total: number
  onPrev: () => void
  onNext: () => void
}) {
  if (total <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 pt-1">
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page === 0}
        onClick={onPrev}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[3rem] text-center text-xs text-muted-foreground">{page + 1} / {total}</span>
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page >= total - 1}
        onClick={onNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

export default function RealtimeProjectStatus() {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

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
    const interval = setInterval(fetchProjects, 2000)

    const channel = supabase
      .channel('project_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_status' }, () => {
        fetchProjects()
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  const filtered = projects.filter(
    (p) =>
      p.repo_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.project_group || '').toLowerCase().includes(search.toLowerCase())
  )

  const mobileTotalPages = Math.max(1, Math.ceil(filtered.length / MOBILE_PAGE_SIZE))
  const desktopTotalPages = Math.max(1, Math.ceil(filtered.length / DESKTOP_PAGE_SIZE))
  const desktopItems = filtered.slice(desktopPage * DESKTOP_PAGE_SIZE, (desktopPage + 1) * DESKTOP_PAGE_SIZE)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const page = Math.round(el.scrollLeft / el.offsetWidth)
    setMobilePage(page)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 sm:flex-none sm:w-48 md:w-64">
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
             <div key={pageIdx} className="grid grid-cols-2 gap-3 snap-start min-w-full shrink-0">
              {pageItems.map((project) => (
                <ProjectCard key={project.id} project={project} onClick={() => setSelectedProject(project)} />
              ))}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No projects found.</p>
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

      {/* Desktop: paginated card grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {desktopItems.map((project) => (
            <ProjectCard key={project.id} project={project} onClick={() => setSelectedProject(project)} />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No projects found.</p>
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

      <ProjectDetailDialog
        project={selectedProject}
        open={!!selectedProject}
        onOpenChange={(open) => { if (!open) setSelectedProject(null) }}
      />
    </div>
  )
}