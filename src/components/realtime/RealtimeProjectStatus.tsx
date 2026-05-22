'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search } from 'lucide-react'

type Project = {
  id: string
  repo_name: string
  project_group: string | null
  branch: string | null
  commit_msg: string | null
  status: string
  last_updated: string
}

const statusConfig: Record<string, { dot: string; label: string }> = {
  success: { dot: 'bg-primary', label: 'text-primary' },
  failed: { dot: 'bg-destructive', label: 'text-destructive' },
  running: { dot: 'bg-tertiary', label: 'text-tertiary' },
  canceled: { dot: 'bg-muted-foreground', label: 'text-muted-foreground' },
}

export default function RealtimeProjectStatus() {
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')

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

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
        <input
          type="text"
          placeholder="Search project or group..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-64 bg-card border border-border rounded-sm pl-8 pr-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
        />
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
            {filtered.map((project) => {
              const cfg = statusConfig[project.status] || { dot: 'bg-muted-foreground', label: 'text-muted-foreground' }
              return (
                <tr key={project.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="font-mono text-xs px-4 py-2.5">{project.repo_name}</td>
                  <td className="text-xs px-4 py-2.5 text-muted-foreground">{project.project_group || '—'}</td>
                  <td className="text-xs px-4 py-2.5 text-muted-foreground">{project.branch || '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className={`label-sm ${cfg.label}`}>{project.status}</span>
                    </div>
                  </td>
                  <td className="text-xs px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">{project.commit_msg || '—'}</td>
                  <td className="font-mono text-xs px-4 py-2.5 text-muted-foreground whitespace-nowrap">{new Date(project.last_updated).toLocaleString('id-ID')}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  No projects found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}