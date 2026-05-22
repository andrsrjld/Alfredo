'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

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

const STATUS_PAGE_SIZE = 50

const statusConfig: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'success' | 'warning'; label: string }> = {
  success: { variant: 'success', label: 'success' },
  failed: { variant: 'destructive', label: 'failed' },
  running: { variant: 'warning', label: 'running' },
  canceled: { variant: 'secondary', label: 'canceled' },
  pending: { variant: 'secondary', label: 'pending' },
  skipped: { variant: 'secondary', label: 'skipped' },
  manual: { variant: 'secondary', label: 'manual' },
  created: { variant: 'secondary', label: 'created' },
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

export default function RealtimeProjectStatus() {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [showCount, setShowCount] = useState(STATUS_PAGE_SIZE)
  const [expandedError, setExpandedError] = useState<Set<string>>(new Set())

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

  const visible = filtered.slice(0, showCount)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 md:flex-none md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            type="text"
            placeholder="Search project or group..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowCount(STATUS_PAGE_SIZE) }}
            className="pl-8 font-mono text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground font-mono">{filtered.length} projects</span>
      </div>

      {/* Card view */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:hidden">
        {visible.map((project) => {
          const cfg = statusConfig[project.status] || { variant: 'secondary' as const, label: project.status }
          const isOpen = expandedError.has(project.id)
          return (
            <Card key={project.id} size="sm">
              <CardContent>
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <span className="font-mono text-[11px] text-foreground truncate min-w-0">{project.repo_name}</span>
                  <Badge variant={cfg.variant} className="text-[10px] shrink-0">{cfg.label}</Badge>
                </div>
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground/50">Group</span>
                    <span className="truncate ml-1 max-w-[80px]">{project.project_group || '\u2014'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground/50">Branch</span>
                    <span className="truncate ml-1">{project.branch || '\u2014'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground/50">Updated</span>
                    <span>{formatWIBShort(project.last_updated)}</span>
                  </div>
                </div>
                {project.error_detail && (
                  <Button
                    variant="link"
                    size="xs"
                    className="mt-1.5 text-destructive"
                    onClick={() => {
                      setExpandedError(prev => {
                        const n = new Set(prev)
                        if (n.has(project.id)) n.delete(project.id)
                        else n.add(project.id)
                        return n
                      })
                    }}
                  >
                    {isOpen ? 'Hide error' : 'Show error'}
                  </Button>
                )}
                {isOpen && project.error_detail && (
                  <pre className="mt-1 text-[10px] text-foreground whitespace-pre-wrap break-words font-mono border-t border-border/40 pt-1">{project.error_detail}</pre>
                )}
              </CardContent>
            </Card>
          )
        })}
        {visible.length === 0 && (
          <p className="text-xs text-muted-foreground col-span-full py-6 text-center">No projects found.</p>
        )}
      </div>

      {/* Table view (desktop) */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Repo</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((project) => {
              const cfg = statusConfig[project.status] || { variant: 'secondary' as const, label: project.status }
              const isOpen = expandedError.has(project.id)
              return (
                <>
                  <TableRow key={project.id}>
                    <TableCell className="font-mono text-xs">
                      {project.repo_name}
                      {project.error_detail && (
                        <Button
                          variant="link"
                          size="xs"
                          className="ml-1.5 text-destructive p-0 h-auto"
                          onClick={() => {
                            setExpandedError(prev => {
                              const n = new Set(prev)
                              if (n.has(project.id)) n.delete(project.id)
                              else n.add(project.id)
                              return n
                            })
                          }}
                        >
                          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{project.project_group || '\u2014'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{project.branch || '\u2014'}</TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{project.commit_msg || '\u2014'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{formatWIB(project.last_updated)}</TableCell>
                  </TableRow>
                  {isOpen && project.error_detail && (
                    <TableRow key={`${project.id}-error`}>
                      <TableCell colSpan={6} className="bg-destructive/5">
                        <p className="label-sm text-destructive mb-1">Error Detail</p>
                        <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-mono">{project.error_detail}</pre>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )
            })}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  No projects found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {showCount < filtered.length && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={() => setShowCount(c => c + STATUS_PAGE_SIZE)}>
            Load more ({filtered.length - showCount} remaining)
          </Button>
        </div>
      )}
    </div>
  )
}