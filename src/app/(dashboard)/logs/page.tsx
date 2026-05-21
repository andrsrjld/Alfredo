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
import { Input } from '@/components/ui/input'

type ChatLog = {
  id: string
  pm_number: string
  pm_message: string
  bot_reply: string
  created_at: string
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ChatLog[]>([])
  const [search, setSearch] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function fetchLogs() {
      const { data, error } = await supabase
        .from('chat_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (!error && data) setLogs(data)
    }
    fetchLogs()
  }, [supabase])

  const filtered = logs.filter(
    (l) =>
      l.pm_number.toLowerCase().includes(search.toLowerCase()) ||
      l.pm_message.toLowerCase().includes(search.toLowerCase()) ||
      l.bot_reply.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Chat Logs</h1>
      <Input
        placeholder="Search by number, message, or reply..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PM Number</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Bot Reply</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.pm_number}</TableCell>
                <TableCell className="max-w-xs truncate">{log.pm_message}</TableCell>
                <TableCell className="max-w-xs truncate">{log.bot_reply}</TableCell>
                <TableCell>{new Date(log.created_at).toLocaleString('id-ID')}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
