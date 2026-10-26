'use client'

import { cn } from '@/lib/cn'
import { formatDistance, type Units } from '@/lib/units'

export type ChartWeek = {
  weekNo: number
  phase: string
  targetDistanceM: number
  isCutback: boolean
  isTaper: boolean
}

/**
 * The plan overview bars. Cutbacks and the taper are deliberately legible —
 * a runner reads the shape of their whole block off this chart, so it has to
 * look right as well as be right.
 */
export function MileageChart({
  weeks,
  units = 'KM',
  currentWeek,
  className,
}: {
  weeks: ChartWeek[]
  units?: Units
  currentWeek?: number
  className?: string
}) {
  const peak = Math.max(1, ...weeks.map((w) => w.targetDistanceM))

  return (
    <figure className={cn('w-full', className)}>
      <div className="flex h-[150px] items-end gap-[3px]" role="img" aria-label={`Weekly distance across ${weeks.length} weeks, peaking at ${formatDistance(peak, units)}`}>
        {weeks.map((w) => {
          const active = w.weekNo === currentWeek
          return (
            <div key={w.weekNo} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className={cn(
                  'w-full rounded-t-[3px] transition-all duration-500',
                  active ? 'bg-chalk' : w.isTaper ? 'bg-rust/40/60' : 'bg-rust/40',
                )}
                style={{ height: `${Math.max(3, (w.targetDistanceM / peak) * 100)}%` }}
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md border border-hairline bg-slate-2 px-2 py-1 text-[11px] whitespace-nowrap group-hover:block"
              >
                Week {w.weekNo} · {formatDistance(w.targetDistanceM, units)}
                {w.isCutback && ' · cutback'}
                {w.isTaper && ' · taper'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-1.5 flex gap-[3px]">
        {weeks.map((w) => (
          <span
            key={w.weekNo}
            className={cn(
              'flex-1 text-center text-[10px] tabular',
              w.weekNo === currentWeek ? 'font-bold text-chalk' : 'text-ash-dim',
            )}
          >
            {weeks.length > 16 && w.weekNo % 2 === 0 ? '' : w.weekNo}
          </span>
        ))}
      </div>
    </figure>
  )
}
