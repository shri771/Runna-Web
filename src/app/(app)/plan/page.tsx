import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, CalendarRange, Link2 } from 'lucide-react'
import { AppHeader } from '@/components/nav/app-header'
import { MileageChart } from '@/components/plan/mileage-chart'
import { auth } from '@/lib/auth'
import { GOAL_LABEL, type Goal } from '@/lib/plan-engine'
import { getActivePlan, getWeeks } from '@/lib/services/plan-service'
import { formatDistance } from '@/lib/units'

export const dynamic = 'force-dynamic'

const GOAL_BADGE: Record<Goal, string> = {
  FIVE_K: '5',
  TEN_K: '10',
  HALF: '21.1',
  MARATHON: '42.2',
  BUILD_MILEAGE: '∞',
}

export default async function PlanPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/sign-in?next=/plan')

  const active = await getActivePlan(session.user.id)
  if (!active?.plan || !active.version) redirect('/onboarding')

  const { plan, version } = active
  const weeks = await getWeeks(version.id)
  const today = new Date().toISOString().slice(0, 10)

  const currentWeek = weeks.find((w) => w.startDate <= today && w.endDate >= today)
  const all = weeks.flatMap((w) => w.workouts)
  const completed = all.filter((x) => x.status === 'COMPLETED')
  const completedM = completed.reduce((s, x) => s + x.plannedDistanceM, 0)
  const scheduledToDate = all.filter((x) => x.date <= today)

  const daysToRace = plan.raceDate
    ? Math.round((Date.parse(`${plan.raceDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
    : null

  return (
    <>
      <AppHeader
        title="Your plan"
        user={{ name: session.user.name ?? null, image: session.user.image ?? null }}
      />

      {/* The countdown is the loudest thing on the screen, because it is the
          fact the entire plan hangs off. */}
      <section className="overflow-hidden rounded-[14px] border border-hairline-strong bg-slate">
        <span aria-hidden className="block h-1 bg-amber" />
        <div className="p-5">
          <p className="text-[12px] font-semibold tracking-wide text-amber">
            {plan.goal === 'BUILD_MILEAGE' ? 'Mileage block' : 'Goal race'}
          </p>
          <h2 className="mt-1 text-[26px] leading-tight font-bold tracking-tight">
            {plan.raceName || GOAL_LABEL[plan.goal as Goal]}
          </h2>

          {daysToRace !== null && daysToRace >= 0 ? (
            <div className="mt-5 flex items-end gap-6">
              <div>
                <p className="fig text-[56px] leading-[0.85] font-bold text-amber">{daysToRace}</p>
                <p className="unit mt-2">{daysToRace === 1 ? 'Day to go' : 'Days to go'}</p>
              </div>
              <div className="pb-1">
                <p className="fig text-[22px] leading-none font-semibold">
                  {GOAL_BADGE[plan.goal as Goal]}
                  <span className="ml-1 text-[13px] font-medium text-ash">km</span>
                </p>
                <p className="mt-1 text-[13px] text-ash">
                  {plan.raceDate &&
                    new Date(`${plan.raceDate}T00:00:00Z`).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                      timeZone: 'UTC',
                    })}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[14px] text-ash">{plan.totalWeeks} week block</p>
          )}
        </div>
      </section>

      <nav aria-label="Plan actions" className="mt-4 grid grid-cols-3 gap-2">
        {[
          { href: '/calendar', label: 'Calendar', Icon: CalendarRange },
          { href: '/link', label: 'Link runs', Icon: Link2 },
          { href: '/plan/guide', label: 'Run types', Icon: BookOpen },
        ].map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 rounded-[14px] border border-hairline bg-slate/60 px-2 py-4 text-[13px] text-ash transition-colors hover:border-hairline-strong hover:text-chalk"
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </nav>

      <section className="mt-4 rounded-[14px] border border-hairline bg-slate/60 p-5">
        <h2 className="text-[15px] font-semibold">Week by week</h2>
        <p className="mt-0.5 text-[13px] text-ash">
          The dips are deliberate — cutback weeks let the training land.
        </p>

        <MileageChart
          weeks={weeks.map((w) => ({
            weekNo: w.weekNo,
            phase: w.phase,
            targetDistanceM: w.targetDistanceM,
            isCutback: w.isCutback,
            isTaper: w.isTaper,
          }))}
          currentWeek={currentWeek?.weekNo}
          className="mt-4"
        />

        <dl className="mt-5 divide-y divide-hairline border-t border-hairline">
          <Row
            label={currentWeek ? `Week ${currentWeek.weekNo}` : 'This week'}
            value={
              currentWeek
                ? `${currentWeek.workouts.filter((x) => x.status === 'COMPLETED').length}/${currentWeek.workouts.length} sessions`
                : 'Outside your plan'
            }
          />
          <Row
            label="Distance"
            value={`${formatDistance(completedM, 'KM', 0)} of ${formatDistance(version.totalDistanceM, 'KM', 0)}`}
          />
          <Row
            label="Sessions completed"
            value={`${completed.length} of ${all.length}`}
          />
          <Row
            label="Adherence"
            value={
              scheduledToDate.length > 0
                ? `${Math.round((completed.length / scheduledToDate.length) * 100)}%`
                : 'Not started'
            }
          />
        </dl>
      </section>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-3">
      <dt className="text-[14px] text-ash">{label}</dt>
      <dd className="fig text-[16px] font-semibold">{value}</dd>
    </div>
  )
}
