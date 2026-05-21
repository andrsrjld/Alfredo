'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

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

  const statusVariant: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
    success: 'default',
    failed: 'destructive',
    running: 'secondary',
    canceled: 'outline',
  }

  const filtered = projects.filter(
    (p) =>
      p.repo_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.project_group || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search project or group..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="rounded-md border overflow-x-auto">
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
            {filtered.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="font-medium">{project.repo_name}</TableCell>
                <TableCell>{project.project_group || '-'}</TableCell>
                <TableCell>{project.branch || '-'}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[project.status] || 'outline'}>{project.status}</Badge>
                </TableCell>
                <TableCell className="max-w-xs truncate">{project.commit_msg || '-'}</TableCell>
                <TableCell>{new Date(project.last_updated).toLocaleString('id-ID')}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No projects found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
