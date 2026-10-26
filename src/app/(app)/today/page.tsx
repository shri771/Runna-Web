import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { startOfWeek } from '@/lib/plan-engine'
import { getTodayData } from '@/lib/services/today-service'
import { WeekStrip } from '@/components/plan/week-strip'
import { WorkoutCard, type CardWorkout } from '@/components/workout/workout-card'
import { AppHeader } from '@/components/nav/app-header'
import { formatDistance } from '@/lib/units'

export const dynamic = 'force-dynamic'

function todayIn(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; created?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/sign-in?next=/today')

  const { date: dateParam, created } = await searchParams
  const today = todayIn('Asia/Kolkata')
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? '') ? dateParam! : today

  const data = await getTodayData(session.user.id, date, today)
  if (!data) redirect('/onboarding')

  const { week, strip, selected, totals, missedThisWeek } = data
  const weekStart = startOfWeek(date)

  const dateLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })

  return (
    <>
      <AppHeader
        title={week ? `Week ${week.weekNo} of ${data.plan.totalWeeks}` : 'Today'}
        subtitle={week?.phase ? phaseLabel(week.phase) : undefined}
        user={{ name: session.user.name ?? null, image: session.user.image ?? null }}
      />

      {created && (
        <p className="mb-4 rounded-[14px] border border-hairline bg-slate px-4 py-3 text-[14px]">
          Your plan is ready. Here is today.
        </p>
      )}

      <WeekStrip strip={strip} selected={date} />

      <div className="mt-6 space-y-4">
        {selected.length === 0 ? (
          <RestCard date={dateLabel} next={nextUp(data.weekWorkouts, date)} />
        ) : (
          selected.map((w) => (
            <WorkoutCard key={w.id} workout={w as unknown as CardWorkout} dateLabel={dateLabel} />
          ))
        )}

        {missedThisWeek >= 3 && (
          <div className="rounded-[14px] border border-caution/40 bg-caution/10 p-4">
            <p className="text-[14px]">
              You have missed {missedThisWeek} sessions this week.
            </p>
            <p className="mt-0.5 text-[13px] text-ash">
              Rebuilding the rest of your plan around where you are now usually works better than
              trying to catch up.
            </p>
            <Link href="/plan" className="mt-3 inline-block text-[13px] font-medium underline">
              Review your plan
            </Link>
          </div>
        )}

        <section className="rounded-[14px] border border-hairline bg-slate p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">
              {week ? `Week ${week.weekNo}` : 'This week'}
            </h2>
            <Link href={`/calendar?week=${weekStart}`} className="text-[13px] text-ash hover:text-chalk">
              Calendar
            </Link>
          </div>

          <div className="mt-3 flex gap-1" aria-hidden>
            {Array.from({ length: Math.max(1, totals.plannedWorkouts) }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i < totals.completedWorkouts ? 'bg-chalk' : 'bg-slate-3'
                }`}
              />
            ))}
          </div>

          <dl className="mt-3 flex justify-between text-[13px]">
            <div className="flex gap-1.5">
              <dt className="text-ash">Sessions</dt>
              <dd className="fig font-semibold">
                {totals.completedWorkouts}/{totals.plannedWorkouts}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-ash">Distance</dt>
              <dd className="fig font-semibold">
                {formatDistance(totals.completedDistanceM)} / {formatDistance(totals.plannedDistanceM)}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  )
}

function RestCard({ date, next }: { date: string; next: string | null }) {
  return (
    <section className="rounded-[14px] border border-hairline bg-slate p-5">
      <h2 className="text-[18px] font-semibold">Rest day</h2>
      <p className="mt-1 text-[14px] text-ash">
        Nothing scheduled for {date}. Recovery is where the training lands.
      </p>
      {next && <p className="mt-3 text-[13px] text-ash">Next up: {next}</p>}
    </section>
  )
}

function nextUp(all: { date: string; name: string }[], from: string): string | null {
  const upcoming = all.filter((w) => w.date > from).sort((a, b) => a.date.localeCompare(b.date))[0]
  if (!upcoming) return null
  const when = new Date(`${upcoming.date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  })
  return `${upcoming.name}, ${when}`
}

const phaseLabel = (phase: string) =>
  ({ BASE: 'Building base', BUILD: 'Building', PEAK: 'Peak weeks', TAPER: 'Tapering', RACE: 'Race week' })[
    phase
  ] ?? phase

