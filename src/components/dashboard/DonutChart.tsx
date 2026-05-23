'use client'

import { cn } from '@/lib/utils'

interface DonutChartProps {
  data: { value: number; colorClass: string; label?: string }[]
  size?: number
  strokeWidth?: number
  className?: string
  centerLabel?: string
  centerSubLabel?: string
}

export function DonutChart({
  data,
  size = 120,
  strokeWidth = 14,
  className,
  centerLabel,
  centerSubLabel,
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const segments = data.map((d, i) => {
    if (total === 0) return null
    const segment = (d.value / total) * circumference
    return { ...d, segment, index: i }
  }).filter(Boolean)

  let offset = 0

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(
        'relative shrink-0 w-20 h-20 md:w-[120px] md:h-[120px]',
      )}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-muted/20"
            strokeWidth={strokeWidth}
          />
          {segments.map((seg) => {
            const dashArray = `${seg!.segment} ${circumference - seg!.segment}`
            const el = (
              <circle
                key={seg!.index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                className={seg!.colorClass}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            )
            offset += seg!.segment
            return el
          })}
        </svg>
        {(centerLabel || centerSubLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground pointer-events-none">
            {centerLabel && <span className="text-lg font-bold tracking-tight leading-none md:text-xl">{centerLabel}</span>}
            {centerSubLabel && <span className="text-[10px] text-muted-foreground mt-0.5 md:text-xs">{centerSubLabel}</span>}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 md:gap-1.5 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 md:gap-2">
            <span className={cn('shrink-0 inline-block h-2 w-2 rounded-full md:h-2.5 md:w-2.5', d.colorClass)} />
            <span className="text-xs text-muted-foreground md:text-sm truncate">{d.label || 'Item'}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground text-xs md:text-sm">{d.value}</span>
          </div>
        ))}
        {total > 0 && (
          <div className="mt-0.5 border-t border-border pt-0.5 md:mt-1 md:pt-1 flex items-center gap-1.5 md:gap-2 text-xs text-muted-foreground">
            <span className="shrink-0 inline-block h-2 w-2 rounded-full bg-muted md:h-2.5 md:w-2.5" />
            <span>Total</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">{total}</span>
          </div>
        )}
      </div>
    </div>
  )
}