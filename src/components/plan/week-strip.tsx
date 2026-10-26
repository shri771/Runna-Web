'use client'

import Link from 'next/link'
import { cn } from '@/lib/cn'
import type { DayCell } from '@/lib/services/today-service'
import { WORKOUT_COLOR } from '@/lib/workout-colors'
import type { WorkoutType } from '@/lib/plan-engine/types'

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export function WeekStrip({ strip, selected }: { strip: DayCell[]; selected: string }) {
  return (
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
                day.isToday && 'bg-chalk text-ink',
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
  )
}
