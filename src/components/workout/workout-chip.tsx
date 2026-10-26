import Link from 'next/link'
import { Check, SkipForward, Zap } from 'lucide-react'
import { Silhouette } from '@/components/workout/silhouette'
import { cn } from '@/lib/cn'
import type { WorkoutStep, WorkoutType } from '@/lib/plan-engine/types'
import { formatDistance } from '@/lib/units'
import { WORKOUT_COLOR } from '@/lib/workout-colors'

export type ChipWorkout = {
  id: string
  date: string
  name: string
  type: WorkoutType
  status: 'SCHEDULED' | 'COMPLETED' | 'SKIPPED'
  plannedDistanceM: number
  steps: WorkoutStep[]
  linked?: boolean
}

export function WorkoutChip({ workout, className }: { workout: ChipWorkout; className?: string }) {
  const color = WORKOUT_COLOR[workout.type]
  const done = workout.status === 'COMPLETED'
  const skipped = workout.status === 'SKIPPED'

  return (
    <Link
      href={`/workouts/${workout.id}`}
      className={cn(
        'group flex min-w-0 overflow-hidden rounded-[9px] border border-hairline bg-slate-2 transition hover:border-hairline-strong',
        skipped && 'opacity-45',
        className,
      )}
    >
      <span aria-hidden className="w-[4px] shrink-0" style={{ backgroundColor: color }} />

      <span className="min-w-0 flex-1 px-3 py-2">
        <span className="flex items-center gap-1.5">
          <span className={cn('truncate text-[14px] font-medium', done && 'text-ash')}>
            {workout.name}
          </span>
          {workout.linked && <Zap size={12} className="shrink-0" style={{ color }} />}
          {done && !workout.linked && <Check size={12} className="shrink-0 text-ash" />}
          {skipped && <SkipForward size={12} className="shrink-0 text-ash" />}
        </span>

        <span className="mt-1 flex items-center gap-2">
          <span className="fig text-[13px] text-ash">{formatDistance(workout.plannedDistanceM)}</span>
          <Silhouette steps={workout.steps} type={workout.type} height={10} className="max-w-[70px] opacity-70" />
        </span>
      </span>
    </Link>
  )
}
