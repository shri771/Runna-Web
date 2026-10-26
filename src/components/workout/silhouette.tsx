import { silhouette } from '@/lib/silhouette'
import { cn } from '@/lib/cn'
import { WORKOUT_COLOR } from '@/lib/workout-colors'
import type { WorkoutStep, WorkoutType } from '@/lib/plan-engine/types'

/**
 * The shape of a session. See docs/DESIGN-DIRECTION.md — this is the one
 * element allowed to be bold, so everything around it stays quiet.
 */
export function Silhouette({
  steps,
  type,
  height = 28,
  className,
  label,
}: {
  steps: WorkoutStep[]
  type: WorkoutType
  height?: number
  className?: string
  label?: string
}) {
  const bars = silhouette(steps)
  if (bars.length === 0) return null

  const color = WORKOUT_COLOR[type]

  return (
    <div
      className={cn('flex w-full items-end gap-px', className)}
      style={{ height }}
      role="img"
      aria-label={label ?? 'Session intensity profile'}
    >
      {bars.map((bar, i) => (
        <span
          key={i}
          className="min-w-[2px] rounded-t-[1px]"
          style={{
            flexGrow: Math.max(bar.width, 0.004),
            flexBasis: 0,
            height: `${Math.max(14, bar.height * 100)}%`,
            backgroundColor: color,
            // Recovery jogs inside an interval session read as the valleys
            // between reps rather than as work.
            opacity: 0.35 + bar.height * 0.65,
          }}
        />
      ))}
    </div>
  )
}
