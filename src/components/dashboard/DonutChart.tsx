'use client'

import { cn } from '@/lib/utils'

interface DonutChartProps {
  data: { value: number; colorClass: string; label?: string; key?: string }[]
  className?: string
  legendClassName?: string
  centerLabel?: string
  centerSubLabel?: string
  activeKey?: string | null
  onSelect?: (key: string | null) => void
}

export function DonutChart({
  data,
  className,
  legendClassName,
  centerLabel,
  centerSubLabel,
  activeKey,
  onSelect,
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const percent = total > 0 && centerLabel ? Math.round((Number(centerLabel) / total) * 100) : 0

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <div className="grid grid-cols-[auto_1fr] items-end gap-4">
        <div>
          {centerLabel && <div className="text-3xl font-semibold leading-none tabular-nums">{centerLabel}</div>}
          {centerSubLabel && <div className="mt-1 text-xs text-muted-foreground">{centerSubLabel}</div>}
        </div>
        <div className="text-right">
          <div className="text-sm font-medium tabular-nums">{percent}%</div>
          <div className="text-xs text-muted-foreground">healthy ratio</div>
        </div>
      </div>

      <div className="flex h-3 w-full overflow-hidden rounded-sm bg-muted">
        {data.map((d, i) => (
          <span
            key={i}
            className={cn('h-full bg-current', d.colorClass)}
            style={{ width: total > 0 ? `${(d.value / total) * 100}%` : `${100 / Math.max(data.length, 1)}%` }}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className={cn('grid gap-2 sm:grid-cols-2 lg:grid-cols-4', legendClassName)}>
        {data.map((d, i) => {
          const itemPercent = total > 0 ? Math.round((d.value / total) * 100) : 0
          const selected = !!d.key && activeKey === d.key
          const interactive = !!d.key && !!onSelect
          const content = (
            <>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">{d.label || 'Item'}</span>
                <span className={cn('h-2 w-6 shrink-0 rounded-sm bg-current', d.colorClass)} />
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-lg font-semibold leading-none tabular-nums">{d.value}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">{itemPercent}%</span>
              </div>
            </>
          )

          if (interactive) {
            return (
              <button
                key={i}
                type="button"
                aria-pressed={selected}
                className={cn(
                  'rounded-md border bg-background/60 px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  selected && 'border-primary bg-accent'
                )}
                onClick={() => onSelect(selected ? null : d.key!)}
              >
                {content}
              </button>
            )
          }

          return (
            <div key={i} className="rounded-md border bg-background/60 px-3 py-2">
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
