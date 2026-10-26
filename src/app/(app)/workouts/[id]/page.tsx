import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { StepList } from '@/components/workout/step-list'
import { Silhouette } from '@/components/workout/silhouette'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  activities,
  athleteProfiles,
  planVersions,
  planWeeks,
  plans,
  workoutActivityLinks,
  workouts,
} from '@/lib/db/schema'
import {
  TEMPLATE_NOTES,
  TYPE_GUIDANCE,
  derivePaceZones,
  type Ability,
  type PaceBasis,
  type WorkoutType,
} from '@/lib/plan-engine'
import { formatDistance, formatDuration, formatDurationEstimate, formatPace } from '@/lib/units'
import { WORKOUT_COLOR, WORKOUT_LABEL } from '@/lib/workout-colors'

export const dynamic = 'force-dynamic'

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/sign-in')

  const { id } = await params

  const [row] = await db
    .select({ workout: workouts, link: workoutActivityLinks, activity: activities, week: planWeeks })
    .from(workouts)
    .innerJoin(planWeeks, eq(planWeeks.id, workouts.planWeekId))
    .innerJoin(planVersions, eq(planVersions.id, planWeeks.planVersionId))
    .innerJoin(plans, eq(plans.id, planVersions.planId))
    .leftJoin(workoutActivityLinks, eq(workoutActivityLinks.workoutId, workouts.id))
    .leftJoin(activities, eq(activities.id, workoutActivityLinks.activityId))
    .where(and(eq(workouts.id, id), eq(plans.userId, session.user.id)))
    .limit(1)

  // Someone else's workout is indistinguishable from one that does not exist.
  if (!row) notFound()

  const { workout, activity, link, week } = row

  const [profile] = await db
    .select()
    .from(athleteProfiles)
    .where(eq(athleteProfiles.userId, session.user.id))
    .limit(1)

  const basis: PaceBasis | undefined =
    profile?.paceBasisKind === 'RACE_RESULT' && profile.paceBasisDistanceM && profile.paceBasisTimeS
      ? { kind: 'RACE_RESULT', distanceM: profile.paceBasisDistanceM, timeS: profile.paceBasisTimeS }
      : profile?.paceBasisKind === 'ESTIMATED_5K' && profile.paceBasisTimeS
        ? { kind: 'ESTIMATED_5K', timeS: profile.paceBasisTimeS }
        : undefined

  const zones = derivePaceZones(basis, (profile?.ability ?? 'INTERMEDIATE') as Ability)
  const type = workout.type as WorkoutType
  const guidance = TYPE_GUIDANCE[type]
  const note = TEMPLATE_NOTES[workout.templateId]
  const color = WORKOUT_COLOR[type]

  return (
    <>
      <div className="py-4">
        <Link
          href={`/today?date=${workout.date}`}
          className="inline-flex items-center gap-1.5 text-[14px] text-ash hover:text-chalk"
        >
          <ArrowLeft size={16} /> Back
        </Link>
      </div>

      <article className="overflow-hidden rounded-[14px] border border-hairline bg-slate">
        <div className="flex">
          <span aria-hidden className="w-[5px] shrink-0" style={{ backgroundColor: color }} />
          <div className="min-w-0 flex-1 p-5">
            <p className="text-[13px]" style={{ color }}>
              {WORKOUT_LABEL[type]}
            </p>
            <h1 className="mt-1 text-[24px] leading-tight font-semibold tracking-tight">
              {workout.name}
            </h1>
            <p className="mt-1 text-[14px] text-ash">
              {new Date(`${workout.date}T00:00:00Z`).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                timeZone: 'UTC',
              })}
              {week && ` · Week ${week.weekNo}`}
              {workout.movedFromDate && ' · moved'}
            </p>

            <dl className="mt-4 flex gap-6">
              <div>
                <dd className="fig text-[24px] leading-none font-bold">
                  {formatDistance(workout.plannedDistanceM)}
                </dd>
                <dt className="unit mt-1">Distance</dt>
              </div>
              <div>
                <dd className="fig text-[24px] leading-none font-bold">
                  {formatDurationEstimate(workout.estDurationMinS, workout.estDurationMaxS)}
                </dd>
                <dt className="unit mt-1">Estimated</dt>
              </div>
            </dl>

            <Silhouette steps={workout.steps} type={type} height={38} className="mt-4" />
          </div>
        </div>
      </article>

      <section className="mt-4 rounded-[14px] border border-hairline bg-slate p-5">
        <h2 className="text-[15px] font-semibold">What this session is</h2>
        <p className="mt-2 text-[14px] text-ash">{guidance.what}</p>
        <p className="mt-3 text-[14px]">
          <span className="font-medium">How to run it. </span>
          <span className="text-ash">{guidance.how}</span>
        </p>
        <p className="mt-3 text-[14px]">
          <span className="font-medium">Why it is here. </span>
          <span className="text-ash">{guidance.why}</span>
        </p>
        {note && (
          <p className="mt-3 border-t border-hairline pt-3 text-[14px] text-ash">{note}</p>
        )}
      </section>

      <section className="mt-4 rounded-[14px] border border-hairline bg-slate p-5">
        <h2 className="text-[15px] font-semibold">The session</h2>
        <p className="mt-0.5 text-[13px] text-ash">
          Paces are worked out from your own fitness, and each one is a range rather than a single
          number.
        </p>
        <div className="mt-4">
          <StepList steps={workout.steps} zones={zones} />
        </div>
      </section>

      {activity && (
        <section className="mt-4 rounded-[14px] border border-hairline bg-slate p-5">
          <h2 className="text-[15px] font-semibold">What you ran</h2>
          <dl className="mt-3 space-y-2">
            <Compare label="Distance" planned={formatDistance(workout.plannedDistanceM)} actual={formatDistance(activity.distanceM)} />
            <Compare label="Time" planned={formatDurationEstimate(workout.estDurationMinS, workout.estDurationMaxS)} actual={formatDuration(activity.movingTimeS)} />
            <Compare label="Average pace" planned="—" actual={formatPace(activity.avgPaceSPerKm)} />
          </dl>
          {link?.compliance && (
            <p className="mt-4 inline-block rounded-full border border-hairline px-3 py-1 text-[13px]">
              {{ NAILED: 'On target', CLOSE: 'Close to target', OFF: 'Off target' }[link.compliance]}
            </p>
          )}
        </section>
      )}

      <div className="h-6" />
    </>
  )
}

function Compare({ label, planned, actual }: { label: string; planned: string; actual: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2 last:border-0">
      <dt className="text-[14px] text-ash">{label}</dt>
      <dd className="fig flex gap-4 text-[14px]">
        <span className="text-ash-dim">{planned}</span>
        <span className="w-[86px] text-right font-semibold">{actual}</span>
      </dd>
    </div>
  )
}
