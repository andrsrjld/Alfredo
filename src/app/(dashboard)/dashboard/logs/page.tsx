'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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

  useEffect(() => {
    const supabase = createClient()
    async function fetchLogs() {
      const { data, error } = await supabase
        .from('chat_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (!error && data) setLogs(data)
    }
    fetchLogs()
  }, [])

  const filtered = logs.filter(
    (l) =>
      l.pm_number.toLowerCase().includes(search.toLowerCase()) ||
      l.pm_message.toLowerCase().includes(search.toLowerCase()) ||
      l.bot_reply.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-5 md:p-lg space-y-md">
      <p className="label-sm text-muted-foreground">Chat Logs</p>
      <input
        type="text"
        placeholder="Search by number, message, or reply..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full md:w-64 bg-card border border-border rounded-sm px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
      />
      <div className="border border-border rounded-md overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="label-sm text-muted-foreground text-left px-4 py-2.5">PM Number</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-2.5">Message</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-2.5">Bot Reply</th>
              <th className="label-sm text-muted-foreground text-left px-4 py-2.5">Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                <td className="font-mono text-xs px-4 py-2.5">{log.pm_number}</td>
                <td className="text-xs px-4 py-2.5 max-w-xs truncate">{log.pm_message}</td>
                <td className="text-xs px-4 py-2.5 max-w-xs truncate text-muted-foreground">{log.bot_reply}</td>
                <td className="font-mono text-xs px-4 py-2.5 text-muted-foreground">{new Date(log.created_at).toLocaleString('id-ID')}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  No logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}