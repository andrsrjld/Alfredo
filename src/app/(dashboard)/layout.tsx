import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 border-r bg-card p-4 space-y-4">
        <div className="text-xl font-bold">Alfredo</div>
        <nav className="space-y-2">
          <Link href="/dashboard" className="block p-2 rounded hover:bg-muted">Dashboard</Link>
          <Link href="/dashboard/logs" className="block p-2 rounded hover:bg-muted">Logs</Link>
          <Link href="/dashboard/override" className="block p-2 rounded hover:bg-muted">Override</Link>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col">
        <header className="border-b p-4 flex items-center justify-between">
          <div className="font-semibold">Alfredo</div>
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-muted-foreground hover:text-foreground">Sign out</button>
          </form>
        </header>
        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}
