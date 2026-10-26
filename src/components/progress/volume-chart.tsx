import { cn } from '@/lib/cn'
import { formatDistance } from '@/lib/units'

/**
 * Weekly volume. Bars are chalk because this is a record of what happened,
 * not a value judgement — a down week in a taper is the plan working.
 */
export function VolumeChart({
  buckets,
  className,
}: {
  buckets: { weekStart: string; distanceM: number }[]
  className?: string
}) {
  const peak = Math.max(1, ...buckets.map((b) => b.distanceM))

  return (
    <figure className={cn('w-full', className)}>
      <div
        className="flex h-[132px] items-end gap-1.5"
        role="img"
        aria-label={`Weekly distance over ${buckets.length} weeks, highest ${formatDistance(peak)}`}
      >
        {buckets.map((b, i) => {
          const isCurrent = i === buckets.length - 1
          return (
            <div key={b.weekStart} className="group relative flex h-full flex-1 flex-col justify-end">
              <span
                className={cn(
                  'w-full rounded-t-[2px] transition-[height] duration-500',
                  isCurrent ? 'bg-amber' : 'bg-slate-3',
                )}
                style={{ height: `${Math.max(b.distanceM === 0 ? 2 : 6, (b.distanceM / peak) * 100)}%` }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded-md border border-hairline bg-slate-2 px-2 py-1 text-[11px] whitespace-nowrap group-hover:block">
                {formatDistance(b.distanceM)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        {buckets.map((b, i) => (
          <span key={b.weekStart} className="fig flex-1 text-center text-[10px] text-ash-dim">
            {i % 2 === 0 || i === buckets.length - 1
              ? new Date(`${b.weekStart}T00:00:00Z`).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                })
              : ''}
          </span>
        ))}
      </div>
    </figure>
  )
}
