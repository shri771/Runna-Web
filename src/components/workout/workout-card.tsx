'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Check, Link2, Loader2, Zap } from 'lucide-react'
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

export function WorkoutCard({ workout, dateLabel }: { workout: CardWorkout; dateLabel: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [optimisticDone, setOptimisticDone] = useState(workout.status === 'COMPLETED')
  const [error, setError] = useState<string | null>(null)

  const done = optimisticDone
  const color = WORKOUT_COLOR[workout.type]

  async function toggle() {
    const nextDone = !done
    setOptimisticDone(nextDone)
    setError(null)
    try {
      const res = await fetch(`/api/workouts/${workout.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextDone ? 'COMPLETED' : 'SCHEDULED' }),
      })
      if (!res.ok) throw new Error()
      startTransition(() => router.refresh())
    } catch {
      setOptimisticDone(!nextDone) // roll back, and say so
      setError('Could not save that. Try again.')
    }
  }

  return (
    <article className="overflow-hidden rounded-[14px] border border-hairline bg-slate">
      <div className="flex">
        <span aria-hidden className="w-[5px] shrink-0" style={{ backgroundColor: color }} />

        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <a
                href={`/workouts/${workout.id}`}
                className={cn(
                  'text-[18px] leading-tight font-semibold hover:underline',
                  done && 'text-ash',
                )}
              >
                {workout.name}
              </a>
              <p className="mt-1 text-[13px] text-ash">
                {dateLabel} · {formatDurationEstimate(workout.estDurationMinS, workout.estDurationMaxS)}
              </p>
            </div>

            <button
              type="button"
              onClick={toggle}
              disabled={pending}
              aria-pressed={done}
              aria-label={done ? `Mark ${workout.name} not done` : `Mark ${workout.name} done`}
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-full border transition',
                done ? 'border-amber bg-amber text-ink' : 'border-hairline-strong text-ash hover:text-chalk',
              )}
            >
              {pending ? <Loader2 size={16} className="animate-spin" /> : done ? <Check size={18} /> : null}
            </button>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="fig text-[26px] leading-none font-semibold" style={{ color }}>
              {formatDistance(workout.plannedDistanceM)}
            </span>
            <span className="text-[13px] text-ash">{WORKOUT_LABEL[workout.type]}</span>
          </div>

          <Silhouette
            steps={workout.steps}
            type={workout.type}
            height={30}
            className="mt-3"
            label={`${workout.name} intensity profile`}
          />

          {workout.activity && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ash">
              <Zap size={13} style={{ color }} />
              {formatDistance(workout.activity.distanceM)} · {formatDuration(workout.activity.movingTimeS)} ·{' '}
              {formatPace(workout.activity.avgPaceSPerKm)}
            </p>
          )}

          {!workout.activity && done && (
            <p className="mt-3 text-[13px] text-ash">Marked done without a run attached.</p>
          )}

          <div className="mt-3 flex gap-4">
            <a
              href={`/workouts/${workout.id}`}
              className="inline-flex items-center gap-1.5 text-[13px] text-ash hover:text-chalk"
            >
              <BookOpen size={13} /> How to run it
            </a>
            {!done && (
              <a
                href="/link"
                className="inline-flex items-center gap-1.5 text-[13px] text-ash hover:text-chalk"
              >
                <Link2 size={13} /> Link a run
              </a>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-2 text-[13px] text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
