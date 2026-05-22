'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Project = {
  id: string
  repo_name: string
  project_group: string | null
  branch: string | null
  commit_msg: string | null
  status: string
  last_updated: string
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

  const statusStyles: Record<string, string> = {
    success: 'text-primary',
    failed: 'text-destructive',
    running: 'text-tertiary',
    canceled: 'text-muted-foreground',
  }

  const filtered = projects.filter(
    (p) =>
      p.repo_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.project_group || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search project or group..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full md:w-64 bg-card border border-border rounded-sm px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
      />
      <div className="border border-border rounded-md overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="label-sm text-muted-foreground text-left px-4 py-2.5">Repo</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-2.5">Group</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-2.5 hidden md:table-cell">Branch</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-2.5">Status</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-2.5 hidden lg:table-cell">Commit</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-2.5">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((project) => (
              <tr key={project.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                <td className="font-mono text-xs px-4 py-2.5">{project.repo_name}</td>
                <td className="text-xs px-4 py-2.5 text-muted-foreground">{project.project_group || '—'}</td>
                <td className="text-xs px-4 py-2.5 text-muted-foreground hidden md:table-cell">{project.branch || '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`label-sm ${statusStyles[project.status] || 'text-muted-foreground'}`}>
                    {project.status}
                  </span>
                </td>
                <td className="text-xs px-4 py-2.5 text-muted-foreground max-w-xs truncate hidden lg:table-cell">{project.commit_msg || '—'}</td>
                <td className="font-mono text-xs px-4 py-2.5 text-muted-foreground">{new Date(project.last_updated).toLocaleString('id-ID')}</td>
              </tr>
            ))}
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