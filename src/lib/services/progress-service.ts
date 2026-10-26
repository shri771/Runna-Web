import { and, desc, eq, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { activities, personalRecords, planVersions, planWeeks, plans, workoutActivityLinks, workouts } from '@/lib/db/schema'
import { addDays, startOfWeek, type ISODate } from '@/lib/plan-engine'

/** Distances we track a record for, in the order the grid reads. */
export const PR_DISTANCES = [
  { key: '400M', label: '400m' },
  { key: '1K', label: '1K' },
  { key: '1MI', label: '1 mile' },
  { key: '2MI', label: '2 mile' },
  { key: '5K', label: '5K' },
  { key: '5MI', label: '5 mile' },
  { key: '10K', label: '10K' },
  { key: '10MI', label: '10 mile' },
  { key: 'HALF', label: 'Half' },
  { key: 'MARATHON', label: 'Marathon' },
] as const

export async function getProgress(userId: string, today: ISODate, weeksBack = 8) {
  const firstWeek = addDays(startOfWeek(today), -(weeksBack - 1) * 7)

  const runs = await db
    .select({
      distanceM: activities.distanceM,
      movingTimeS: activities.movingTimeS,
      startedAtLocal: activities.startedAtLocal,
    })
    .from(activities)
    .where(and(eq(activities.userId, userId), gte(activities.startedAtLocal, new Date(firstWeek))))
    .orderBy(desc(activities.startedAtLocal))

  // Bucket by week. Computed here rather than read from weekly_rollups: the
  // cache table exists in the schema but is not worth warming until there is
  // enough history for the aggregate to cost anything.
  const buckets = Array.from({ length: weeksBack }, (_, i) => {
    const weekStart = addDays(firstWeek, i * 7)
    const weekEnd = addDays(weekStart, 6)
    const inWeek = runs.filter((r) => {
      const d = r.startedAtLocal.toISOString().slice(0, 10)
      return d >= weekStart && d <= weekEnd
    })
    return {
      weekStart,
      distanceM: inWeek.reduce((s, r) => s + r.distanceM, 0),
      movingTimeS: inWeek.reduce((s, r) => s + r.movingTimeS, 0),
      count: inWeek.length,
    }
  })

  const thisWeek = buckets.at(-1)!
  const lastWeek = buckets.at(-2)

  const records = await db
    .select()
    .from(personalRecords)
    .where(eq(personalRecords.userId, userId))

  const sessions = await db
    .select({
      id: workouts.id,
      name: workouts.name,
      type: workouts.type,
      date: workouts.date,
      status: workouts.status,
      plannedDistanceM: workouts.plannedDistanceM,
      compliance: workoutActivityLinks.compliance,
      actualDistanceM: activities.distanceM,
      actualPaceSPerKm: activities.avgPaceSPerKm,
    })
    .from(workouts)
    .innerJoin(planWeeks, eq(planWeeks.id, workouts.planWeekId))
    .innerJoin(planVersions, eq(planVersions.id, planWeeks.planVersionId))
    .innerJoin(plans, and(eq(plans.id, planVersions.planId), eq(plans.currentVersionId, planVersions.id)))
    .leftJoin(workoutActivityLinks, eq(workoutActivityLinks.workoutId, workouts.id))
    .leftJoin(activities, eq(activities.id, workoutActivityLinks.activityId))
    .where(and(eq(plans.userId, userId), eq(plans.status, 'ACTIVE')))
    .orderBy(desc(workouts.date))
    .limit(120)

  const done = sessions.filter((s) => s.status === 'COMPLETED')
  const toDate = sessions.filter((s) => s.date <= today)

  return {
    buckets,
    thisWeek,
    deltaPct:
      lastWeek && lastWeek.distanceM > 0
        ? Math.round(((thisWeek.distanceM - lastWeek.distanceM) / lastWeek.distanceM) * 100)
        : null,
    records: new Map(records.map((r) => [r.distanceKey, r])),
    sessions: done.slice(0, 30),
    adherence: {
      completed: done.length,
      scheduled: toDate.length,
      pct: toDate.length > 0 ? Math.round((done.length / toDate.length) * 100) : null,
      nailed: done.filter((s) => s.compliance === 'NAILED').length,
      close: done.filter((s) => s.compliance === 'CLOSE').length,
      off: done.filter((s) => s.compliance === 'OFF').length,
    },
  }
}
