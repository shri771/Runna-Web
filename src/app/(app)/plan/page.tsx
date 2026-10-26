import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarRange, Link2, SlidersHorizontal } from 'lucide-react'
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

      {/* The hero leads with the race, because that is the fact the whole plan
          hangs off — not a stat tile. */}
      <section className="rounded-[14px] border border-hairline bg-slate p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[24px] leading-tight font-semibold tracking-tight">
              {plan.raceName || GOAL_LABEL[plan.goal as Goal]}
            </h2>
            {plan.raceDate ? (
              <p className="mt-1 text-[14px] text-ash">
                {new Date(`${plan.raceDate}T00:00:00Z`).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </p>
            ) : (
              <p className="mt-1 text-[14px] text-ash">{plan.totalWeeks} week block</p>
            )}
          </div>

          <span
            aria-hidden
            className="fig grid size-14 shrink-0 place-items-center rounded-full border border-rust bg-rust/15 text-[15px] font-bold text-rust-bright"
          >
            {GOAL_BADGE[plan.goal as Goal]}
          </span>
        </div>

        {daysToRace !== null && daysToRace >= 0 && (
          <p className="fig mt-4 text-[15px]">
            <span className="text-[32px] leading-none font-bold">{daysToRace}</span>
            <span className="ml-2 text-[14px] text-ash">
              {daysToRace === 1 ? 'day to go' : 'days to go'}
            </span>
          </p>
        )}
      </section>

      <nav aria-label="Plan actions" className="mt-4 grid grid-cols-3 gap-2">
        {[
          { href: '/calendar', label: 'Calendar', Icon: CalendarRange },
          { href: '/link', label: 'Link runs', Icon: Link2 },
          { href: '/settings', label: 'Settings', Icon: SlidersHorizontal },
        ].map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 rounded-[14px] border border-hairline bg-slate px-2 py-4 text-[13px] text-ash transition hover:text-chalk"
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </nav>

      <section className="mt-4 rounded-[14px] border border-hairline bg-slate p-5">
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
