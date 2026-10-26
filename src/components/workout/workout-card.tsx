'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Link2, Loader2, Zap } from 'lucide-react'
import { Silhouette } from '@/components/workout/silhouette'
import { cn } from '@/lib/cn'
import type { WorkoutStep, WorkoutType } from '@/lib/plan-engine/types'
import { formatDistance, formatDuration, formatDurationEstimate, formatPace } from '@/lib/units'
import { WORKOUT_COLOR, WORKOUT_LABEL } from '@/lib/workout-colors'

export type CardWorkout = {
  id: string
  name: string
  type: WorkoutType
  date: string
  status: 'SCHEDULED' | 'COMPLETED' | 'SKIPPED'
  plannedDistanceM: number
  estDurationMinS: number
  estDurationMaxS: number
  steps: WorkoutStep[]
  activity: { id: string; name: string; distanceM: number; movingTimeS: number; avgPaceSPerKm: number } | null
}

/**
 * The hero of the Today screen, so it is the one element allowed to be loud:
 * the distance is set large in the session's own colour, and the silhouette
 * runs the full width beneath it. Everything else on the screen stays quiet.
 */
export function WorkoutCard({ workout, dateLabel }: { workout: CardWorkout; dateLabel: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(workout.status === 'COMPLETED')
  const [error, setError] = useState<string | null>(null)

  const color = WORKOUT_COLOR[workout.type]

  async function toggle() {
    const next = !done
    setDone(next)
    setError(null)
    try {
      const res = await fetch(`/api/workouts/${workout.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next ? 'COMPLETED' : 'SCHEDULED' }),
      })
      if (!res.ok) throw new Error()
      startTransition(() => router.refresh())
    } catch {
      setDone(!next)
      setError('Could not save that. Try again.')
    }
  }

  return (
    <article className="overflow-hidden rounded-[14px] border border-hairline-strong bg-slate">
      {/* A full-width rule in the session colour, rather than a thin side bar:
          the type is the first thing to register. */}
      <span aria-hidden className="block h-1" style={{ backgroundColor: color }} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold tracking-wide" style={{ color }}>
              {WORKOUT_LABEL[workout.type]}
            </p>
            <Link
              href={`/workouts/${workout.id}`}
              className={cn(
                'mt-1 block text-[22px] leading-tight font-semibold tracking-tight hover:underline',
                done && 'text-ash',
              )}
            >
              {workout.name}
            </Link>
            <p className="mt-1 text-[13px] text-ash">{dateLabel}</p>
          </div>

          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            aria-pressed={done}
            aria-label={done ? `Mark ${workout.name} not done` : `Mark ${workout.name} done`}
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full border-2 transition-colors',
              done
                ? 'border-amber bg-amber text-ink'
                : 'border-hairline-strong text-ash hover:border-amber hover:text-amber',
            )}
          >
            {pending ? <Loader2 size={17} className="animate-spin" /> : done ? <Check size={20} strokeWidth={3} /> : null}
          </button>
        </div>

        <div className="mt-5 flex items-end gap-5">
          <div>
            <p className="fig text-[40px] leading-[0.9] font-bold" style={{ color }}>
              {formatDistance(workout.plannedDistanceM)}
            </p>
            <p className="unit mt-1.5">Distance</p>
          </div>
          <div>
            <p className="fig text-[40px] leading-[0.9] font-bold text-chalk">
              {formatDurationEstimate(workout.estDurationMinS, workout.estDurationMaxS).replace(/m/g, '')}
            </p>
            <p className="unit mt-1.5">Minutes</p>
          </div>
        </div>

        <Silhouette
          steps={workout.steps}
          type={workout.type}
          height={44}
          className="mt-5"
          label={`${workout.name} intensity profile`}
        />

        {workout.activity && (
          <p className="fig mt-4 flex items-center gap-2 border-t border-hairline pt-4 text-[14px] text-ash">
            <Zap size={14} style={{ color }} />
            {formatDistance(workout.activity.distanceM)} · {formatDuration(workout.activity.movingTimeS)} ·{' '}
            {formatPace(workout.activity.avgPaceSPerKm)}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[13px] text-danger">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/workouts/${workout.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[14px] font-semibold text-ink transition-colors hover:bg-amber-bright"
          >
            How to run it <ArrowRight size={14} />
          </Link>
          {!done && (
            <Link
              href="/link"
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong px-4 py-2 text-[14px] font-medium transition-colors hover:border-ash"
            >
              <Link2 size={14} /> Link a run
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
