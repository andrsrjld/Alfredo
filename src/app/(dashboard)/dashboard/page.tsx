import RealtimeServerStatus from '@/components/realtime/RealtimeServerStatus'
import RealtimeProjectStatus from '@/components/realtime/RealtimeProjectStatus'

export default function DashboardPage() {
  return (
    <div className="p-5 md:p-8 space-y-10 max-w-[1280px]">
      <section>
        <div className="mb-4">
          <p className="label-sm text-muted-foreground mb-1">Servers</p>
          <p className="text-xs text-muted-foreground/60">Real-time status from cron pings</p>
        </div>
        <RealtimeServerStatus />
      </section>
      <section>
        <div className="mb-4">
          <p className="label-sm text-muted-foreground mb-1">Pipelines</p>
          <p className="text-xs text-muted-foreground/60">GitLab CI/CD pipeline results</p>
        </div>
        <RealtimeProjectStatus />
      </section>
    </div>
  )
}