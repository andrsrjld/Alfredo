'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'

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

const statusConfig: Record<string, { dot: string; label: string }> = {
  success: { dot: 'bg-primary', label: 'text-primary' },
  failed: { dot: 'bg-destructive', label: 'text-destructive' },
  running: { dot: 'bg-tertiary', label: 'text-tertiary' },
  canceled: { dot: 'bg-muted-foreground', label: 'text-muted-foreground' },
}

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
          <input
            type="text"
            placeholder="Search project or group..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowCount(STATUS_PAGE_SIZE) }}
            className="w-full bg-card border border-border rounded-sm pl-8 pr-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
          />
        </div>
        <span className="text-xs text-muted-foreground font-mono">{filtered.length} projects</span>
      </div>
      <div className="border border-border rounded-md overflow-x-auto bg-card">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-border">
              <th className="label-sm text-muted-foreground text-left px-4 py-3">Repo</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-3">Group</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-3">Branch</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-3">Status</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-3">Commit</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((project) => {
              const cfg = statusConfig[project.status] || { dot: 'bg-muted-foreground', label: 'text-muted-foreground' }
              const isOpen = expandedError.has(project.id)
              return (
                <>
                  <tr key={project.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="font-mono text-xs px-4 py-2.5">
                      {project.repo_name}
                      {project.error_detail && (
                        <button onClick={() => {
                          setExpandedError(prev => {
                            const n = new Set(prev)
                            if (n.has(project.id)) n.delete(project.id)
                            else n.add(project.id)
                            return n
                          })
                        }} className="ml-1.5 inline-block align-middle">
                          {isOpen
                            ? <ChevronUp className="h-3 w-3 text-destructive" />
                            : <ChevronDown className="h-3 w-3 text-destructive" />}
                        </button>
                      )}
                    </td>
                    <td className="text-xs px-4 py-2.5 text-muted-foreground">{project.project_group || '—'}</td>
                    <td className="text-xs px-4 py-2.5 text-muted-foreground">{project.branch || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className={`label-sm ${cfg.label}`}>{project.status}</span>
                      </div>
                    </td>
                    <td className="text-xs px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">{project.commit_msg || '—'}</td>
                    <td className="font-mono text-xs px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatWIB(project.last_updated)}</td>
                  </tr>
                  {isOpen && project.error_detail && (
                    <tr key={`${project.id}-error`} className="border-b border-border/30 bg-destructive/5">
                      <td colSpan={6} className="px-4 py-2.5">
                        <p className="label-sm text-destructive mb-1">Error Detail</p>
                        <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-mono">{project.error_detail}</pre>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  No projects found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {showCount < filtered.length && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setShowCount(c => c + STATUS_PAGE_SIZE)}
            className="px-4 py-2 text-xs font-mono border border-border rounded hover:bg-muted/50 transition-colors"
          >
            Load more ({filtered.length - showCount} remaining)
          </button>
        </div>
      )}
    </div>
  )
}