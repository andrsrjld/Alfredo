import RealtimeServerStatus from '@/components/realtime/RealtimeServerStatus'
import RealtimeProjectStatus from '@/components/realtime/RealtimeProjectStatus'
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card'

export default function DashboardPage() {
  return (
    <div className="p-4 lg:p-6 xl:p-8 space-y-6 lg:space-y-8">
      <Card>
        <CardHeader>
          <CardDescription>Servers</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Real-time status from cron pings</p>
          <RealtimeServerStatus />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Pipelines</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">GitLab CI/CD pipeline results</p>
          <RealtimeProjectStatus />
        </CardContent>
      </Card>
    </div>
  )
}