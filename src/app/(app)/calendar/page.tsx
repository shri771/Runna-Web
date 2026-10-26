import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/nav/app-header'
import { WorkoutChip, type ChipWorkout } from '@/components/workout/workout-chip'
import { auth } from '@/lib/auth'
import { getActivePlan, getWeeks } from '@/lib/services/plan-service'
import { formatDistance } from '@/lib/units'
import { cn } from '@/lib/cn'
import { addDays } from '@/lib/plan-engine'

export const dynamic = 'force-dynamic'

const LETTERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const PHASE_LABEL: Record<string, string> = {
  BASE: 'Base',
  BUILD: 'Build',
  PEAK: 'Peak',
  TAPER: 'Taper',
  RACE: 'Race',
}

export default async function CalendarPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/sign-in?next=/calendar')

  const active = await getActivePlan(session.user.id)
  if (!active?.plan || !active.version) redirect('/onboarding')

  const weeks = await getWeeks(active.version.id)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <AppHeader
        title="Calendar"
        subtitle={`${weeks.length} weeks`}
        user={{ name: session.user.name ?? null, image: session.user.image ?? null }}
      />

      <div className="space-y-5 pb-4">
        {weeks.map((week) => {
          const isCurrent = week.startDate <= today && week.endDate >= today
          const doneM = week.workouts
            .filter((w) => w.status === 'COMPLETED')
            .reduce((s, w) => s + w.plannedDistanceM, 0)

          return (
            <section
              key={week.id}
              className={cn(
                'rounded-[14px] border',
                isCurrent ? 'border-chalk/35 bg-slate' : 'border-hairline bg-slate/60',
              )}
              aria-current={isCurrent ? 'date' : undefined}
            >
              <header className="flex items-baseline gap-3 border-b border-hairline px-4 py-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-semibold">
                    Week {week.weekNo}
                    <span className="ml-2 text-[13px] font-normal text-ash">
                      {range(week.startDate, week.endDate)}
                    </span>
                  </h2>
                  <p className="fig mt-0.5 text-[13px] text-ash">
                    {doneM > 0 && `${formatDistance(doneM)} of `}
                    {formatDistance(week.targetDistanceM)}
                    {week.isCutback && <span className="ml-2 font-sans text-ash-dim">cutback</span>}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-hairline px-2.5 py-1 text-[11px] text-ash">
                  {PHASE_LABEL[week.phase] ?? week.phase}
                </span>
              </header>

              <ul className="divide-y divide-hairline">
                {Array.from({ length: 7 }, (_, i) => {
                  const date = addDays(week.startDate, i)
                  const onDay = week.workouts.filter((w) => w.date === date)
                  const isToday = date === today
                  const missed = date < today && onDay.some((w) => w.status === 'SCHEDULED')

                  return (
                    <li key={date} className="flex items-start gap-3 px-4 py-2.5">
                      <div className="w-11 shrink-0 pt-0.5">
                        <p className="text-[11px] text-ash-dim">{LETTERS[i]}</p>
                        <p
                          className={cn(
                            'fig text-[17px] font-semibold',
                            isToday && 'text-chalk',
                            !isToday && missed && 'text-danger',
                            !isToday && !missed && date < today && 'text-ash',
                          )}
                        >
                          {Number(date.slice(8))}
                        </p>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5 pt-1">
                        {onDay.length === 0 ? (
                          <p className="text-[13px] text-ash-dim">Rest</p>
                        ) : (
                          onDay.map((w) => (
                            <WorkoutChip key={w.id} workout={w as unknown as ChipWorkout} />
                          ))
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}

function range(start: string, end: string): string {
  const fmt = (d: string, withMonth: boolean) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      ...(withMonth ? { month: 'short' } : {}),
      timeZone: 'UTC',
    })
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  return `${fmt(start, !sameMonth)} – ${fmt(end, true)}`
}
