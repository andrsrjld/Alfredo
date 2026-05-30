'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Monitor, FileText, Server, Users, Settings, Zap, Menu, X, LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: Monitor },
  { href: '/dashboard/logs', label: 'Chat Logs', icon: FileText },
  { href: '/dashboard/override', label: 'Server', icon: Server },
  { href: '/dashboard/whitelist', label: 'Whitelist', icon: Users },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const pageTitles: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/logs': 'Chat Logs',
  '/dashboard/override': 'Server',
  '/dashboard/whitelist': 'Whitelist',
  '/dashboard/settings': 'Settings',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const pageTitle = pageTitles[pathname] || 'Dashboard'
  const [menuOpen, setMenuOpen] = useState(false)

  const sidebarContent = (
    <>
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary shadow-sm">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-sidebar-foreground">Alfredo</p>
            <p className="text-xs text-muted-foreground">DevOps Companion</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <form action="/api/auth/signout" method="post" className="block">
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Sign out
          </Button>
        </form>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-muted/40">
      <a href="#dashboard-main" className="skip-link">Skip to main content</a>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 md:px-8">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary">
                <Zap className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            </div>
            <span className="truncate text-sm font-semibold text-foreground">{pageTitle}</span>
            <div className="flex-1" />
            <ThemeToggle />
          </div>
        </header>

        <main id="dashboard-main" className="flex-1 overflow-auto pb-16 md:pb-0" tabIndex={-1}>
          {children}
        </main>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Dashboard menu">
          <button
            type="button"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-background shadow-xl">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-8 w-8"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Main navigation"
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} aria-hidden="true" />
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
