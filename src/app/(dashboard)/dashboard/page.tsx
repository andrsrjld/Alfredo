import RealtimeServerStatus from '@/components/realtime/RealtimeServerStatus'
import RealtimeProjectStatus from '@/components/realtime/RealtimeProjectStatus'

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Alfredo Monitoring Dashboard</h1>
      <section>
        <h2 className="text-lg font-semibold mb-4">Server Status</h2>
        <RealtimeServerStatus />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-4">Project Pipeline Status</h2>
        <RealtimeProjectStatus />
      </section>
    </div>
  )
}
