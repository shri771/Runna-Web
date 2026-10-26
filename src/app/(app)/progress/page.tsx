import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/nav/app-header'
import { VolumeChart } from '@/components/progress/volume-chart'
import { auth } from '@/lib/auth'
import { PR_DISTANCES, getProgress } from '@/lib/services/progress-service'
import { formatDistance, formatDuration, formatPace } from '@/lib/units'
import { cn } from '@/lib/cn'
import { WORKOUT_COLOR } from '@/lib/workout-colors'
import type { WorkoutType } from '@/lib/plan-engine/types'

export const dynamic = 'force-dynamic'

const GRADE_LABEL = { NAILED: 'On target', CLOSE: 'Close', OFF: 'Off target' } as const

export default async function ProgressPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/sign-in?next=/progress')

  const today = new Date().toISOString().slice(0, 10)
  const { buckets, thisWeek, deltaPct, records, sessions, adherence } = await getProgress(
    session.user.id,
    today,
  )

  const hasHistory = buckets.some((b) => b.count > 0)

  return (
    <>
      <AppHeader
        title="Progress"
        user={{ name: session.user.name ?? null, image: session.user.image ?? null }}
      />

      <section className="overflow-hidden rounded-[14px] border border-hairline-strong bg-slate">
        <span aria-hidden className="block h-1 bg-amber" />
        <div className="p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">This week</h2>
          {deltaPct !== null && (
            <span className="fig text-[13px] text-ash">
              {deltaPct > 0 ? '+' : ''}
              {deltaPct}% on last week
            </span>
          )}
        </div>

        <div className="mt-4 flex items-end gap-7">
          <div>
            <p className="fig text-[52px] leading-[0.85] font-bold text-amber">
              {(thisWeek.distanceM / 1000).toFixed(1)}
            </p>
            <p className="unit mt-2">Kilometres</p>
          </div>
          <div className="pb-1">
            <p className="fig text-[22px] leading-none font-semibold">
              {formatDuration(thisWeek.movingTimeS)}
            </p>
            <p className="unit mt-1.5">Time</p>
          </div>
          <div className="pb-1">
            <p className="fig text-[22px] leading-none font-semibold">{thisWeek.count}</p>
            <p className="unit mt-1.5">Runs</p>
          </div>
        </div>

        <VolumeChart buckets={buckets} className="mt-5" />

        {!hasHistory && (
          <p className="mt-4 text-[13px] text-ash">
            Nothing logged yet. Link a run and it will show up here.
          </p>
        )}
        </div>
      </section>

      {adherence.scheduled > 0 && (
        <section className="mt-4 rounded-[14px] border border-hairline bg-slate/60 p-5">
          <h2 className="text-[15px] font-semibold">Sticking to the plan</h2>
          <p className="fig mt-3 text-[32px] leading-none font-bold">
            {adherence.pct}%
            <span className="ml-2 font-sans text-[14px] font-normal text-ash">
              {adherence.completed} of {adherence.scheduled} sessions
            </span>
          </p>

          <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-slate-3">
            {(['nailed', 'close', 'off'] as const).map((k) => (
              <span
                key={k}
                className={cn(
                  k === 'nailed' && 'bg-amber',
                  k === 'close' && 'bg-ash',
                  k === 'off' && 'bg-ash-dim',
                )}
                style={{ width: `${(adherence[k] / Math.max(1, adherence.completed)) * 100}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-[13px] text-ash">
            {adherence.nailed} on target · {adherence.close} close · {adherence.off} off
          </p>
        </section>
      )}

      <section className="mt-4">
        <h2 className="text-[15px] font-semibold">Personal records</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PR_DISTANCES.map(({ key, label }) => {
            const record = records.get(key)
            return (
              <li
                key={key}
                className={cn(
                  'rounded-[12px] border p-3',
                  record ? 'border-amber/50 bg-amber/10' : 'border-hairline bg-slate/50',
                )}
              >
                <p className={cn('text-[13px] font-medium', !record && 'text-ash-dim')}>{label}</p>
                {record ? (
                  <>
                    <p className="fig mt-1 text-[20px] leading-none font-bold text-amber-bright">
                      {formatDuration(record.timeS)}
                    </p>
                    <p className="mt-1 text-[11px] text-ash">
                      {record.achievedAt.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[13px] text-ash-dim">Not set</p>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {sessions.length > 0 && (
        <section className="mt-6 pb-4">
          <h2 className="text-[15px] font-semibold">Recent sessions</h2>
          <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-[14px] border border-hairline bg-slate">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className="h-8 w-[4px] shrink-0 rounded-full"
                  style={{ backgroundColor: WORKOUT_COLOR[s.type as WorkoutType] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{s.name}</p>
                  <p className="fig mt-0.5 text-[13px] text-ash">
                    {s.actualDistanceM
                      ? `${formatDistance(s.actualDistanceM)} · ${formatPace(s.actualPaceSPerKm ?? 0)}`
                      : formatDistance(s.plannedDistanceM)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[12px] text-ash">
                    {new Date(`${s.date}T00:00:00Z`).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'UTC',
                    })}
                  </p>
                  {s.compliance && (
                    <p className="text-[12px] text-ash-dim">{GRADE_LABEL[s.compliance]}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

