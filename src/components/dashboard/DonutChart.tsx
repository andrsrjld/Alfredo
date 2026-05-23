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
  let offset = 0

  const mobileSize = Math.min(size, 80)
  const mobileRadius = (mobileSize - strokeWidth) / 2

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative shrink-0" style={{ width: mobileSize, height: mobileSize }}>
        <svg
          width={mobileSize}
          height={mobileSize}
          viewBox={`0 0 ${mobileSize} ${mobileSize}`}
          className="-rotate-90 md:hidden"
        >
          <circle
            cx={mobileSize / 2}
            cy={mobileSize / 2}
            r={mobileRadius}
            fill="none"
            stroke="currentColor"
            className="text-muted/20"
            strokeWidth={strokeWidth}
          />
          {data.map((d, i) => {
            if (total === 0) return null
            const seg = (d.value / total) * (2 * Math.PI * mobileRadius)
            const circ = 2 * Math.PI * mobileRadius
            const dashArray = `${seg} ${circ - seg}`
            const el = (
              <circle
                key={i}
                cx={mobileSize / 2}
                cy={mobileSize / 2}
                r={mobileRadius}
                fill="none"
                stroke="currentColor"
                className={d.colorClass}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            )
            offset += seg
            return el
          })}
        </svg>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="hidden -rotate-90 md:block"
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
          {(() => {
            let off = 0
            return data.map((d, i) => {
              if (total === 0) return null
              const segment = (d.value / total) * circumference
              const dashArray = `${segment} ${circumference - segment}`
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  className={d.colorClass}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  strokeDashoffset={-off}
                  strokeLinecap="round"
                />
              )
              off += segment
              return el
            })
          })()}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground pointer-events-none">
          <span className="text-lg font-bold tracking-tight leading-none md:text-xl">{centerLabel}</span>
          {centerSubLabel && (
            <span className="text-[10px] text-muted-foreground mt-0.5 md:text-xs">{centerSubLabel}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 md:gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 md:gap-2">
            <span className={cn('inline-block h-2 w-2 rounded-full md:h-2.5 md:w-2.5', d.colorClass)} />
            <span className="text-xs text-muted-foreground md:text-sm">{d.label || 'Item'}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground text-xs md:text-sm">{d.value}</span>
          </div>
        ))}
        {total > 0 && (
          <div className="mt-0.5 border-t border-border pt-0.5 flex items-center gap-1.5 md:gap-2 text-xs text-muted-foreground md:mt-1 md:pt-1">
            <span className="inline-block h-2 w-2 rounded-full bg-muted md:h-2.5 md:w-2.5" />
            <span>Total</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">{total}</span>
          </div>
        )}
      </div>
    </div>
  )
}
