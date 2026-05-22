import RealtimeServerStatus from '@/components/realtime/RealtimeServerStatus'
import RealtimeProjectStatus from '@/components/realtime/RealtimeProjectStatus'

export default function DashboardPage() {
  return (
    <div className="p-5 md:p-lg space-y-xl">
      <section>
        <p className="label-sm text-muted-foreground mb-3">Server Status</p>
        <RealtimeServerStatus />
      </section>
      <section>
        <p className="label-sm text-muted-foreground mb-3">Project Pipeline Status</p>
        <RealtimeProjectStatus />
      </section>
    </div>
  )
}