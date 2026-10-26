'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { addDays, startOfWeek } from '@/lib/plan-engine'
import type { DayCell } from '@/lib/services/today-service'
import { WORKOUT_COLOR } from '@/lib/workout-colors'
import type { WorkoutType } from '@/lib/plan-engine/types'

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export function WeekStrip({
  strip,
  selected,
  weekLabel,
}: {
  strip: DayCell[]
  selected: string
  weekLabel?: string
}) {
  // Stepping a week keeps the same weekday selected, which is what someone
  // flicking back through their training actually wants.
  const offsetWeek = (weeks: number) => addDays(selected, weeks * 7)
  const prevWeek = offsetWeek(-1)
  const nextWeek = offsetWeek(1)

  return (
    <div>
      <div className="flex items-center justify-between pb-1">
        <Link
          href={`/today?date=${prevWeek}`}
          aria-label={`Week of ${startOfWeek(prevWeek)}`}
          className="grid size-8 place-items-center rounded-full text-ash transition hover:bg-slate-2 hover:text-chalk"
        >
          <ChevronLeft size={18} />
        </Link>

        <span className="text-[13px] text-ash">{weekLabel}</span>

        <Link
          href={`/today?date=${nextWeek}`}
          aria-label={`Week of ${startOfWeek(nextWeek)}`}
          className="grid size-8 place-items-center rounded-full text-ash transition hover:bg-slate-2 hover:text-chalk"
        >
          <ChevronRight size={18} />
        </Link>
      </div>

      <nav aria-label="This week" className="grid grid-cols-7 gap-1">
      {strip.map((day) => {
        const isSelected = day.date === selected
        return (
          <Link
            key={day.date}
            href={`/today?date=${day.date}`}
            aria-label={`${FULL[day.weekday]} ${day.date}`}
            aria-current={isSelected ? 'date' : undefined}
            className="flex flex-col items-center gap-1 py-1"
          >
            <span className="text-[11px] font-medium text-ash-dim">{LETTERS[day.weekday]}</span>

            <span
              className={cn(
                'fig grid size-9 place-items-center rounded-full text-[17px] font-semibold transition',
                day.isToday && 'bg-amber text-ink',
                !day.isToday && isSelected && 'bg-slate-3 text-chalk',
                !day.isToday && !isSelected && day.missed && 'text-danger',
                !day.isToday && !isSelected && !day.missed && (day.isPast ? 'text-ash' : 'text-chalk'),
              )}
            >
              {Number(day.date.slice(8))}
            </span>

            <span className="flex h-1.5 items-center gap-0.5">
              {day.types.slice(0, 3).map((t, i) => (
                <span
                  key={i}
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: WORKOUT_COLOR[t as WorkoutType] }}
                />
              ))}
            </span>
          </Link>
        )
      })}
      </nav>
    </div>
  )
}
