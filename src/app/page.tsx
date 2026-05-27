import Link from 'next/link'
import { Activity, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PublicOverview from '@/components/realtime/PublicOverview'
import { getPublicOverviewData } from '@/lib/public-overview'

export const dynamic = 'force-dynamic'

export default async function RootPage() {
  const overview = await getPublicOverviewData()

  return (
    <main className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="size-4" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-none">Alfredo</span>
              <span className="text-xs text-muted-foreground">DevOps Companion</span>
            </div>
          </div>
          <Button render={<Link href="/login" />}>
            <LockKeyhole className="size-4" aria-hidden="true" />
            Sign in
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">Live server health and GitLab pipeline status.</p>
        </div>

        <PublicOverview initialData={overview} />
      </div>
    </main>
  )
}
