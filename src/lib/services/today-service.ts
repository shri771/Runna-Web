import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { activities, planWeeks, workoutActivityLinks, workouts } from '@/lib/db/schema'
import { addDays, startOfWeek, weekdayOf, type ISODate } from '@/lib/plan-engine'
import { getActivePlan } from './plan-service'

export type DayCell = {
  date: ISODate
  weekday: number
  isToday: boolean
  isPast: boolean
  types: string[]
  missed: boolean
}

/** Everything the Today screen needs, in one pass. */
export async function getTodayData(userId: string, date: ISODate, today: ISODate) {
  const active = await getActivePlan(userId)
  if (!active?.plan || !active.version) return null

  const weekStart = startOfWeek(date)
  const weekEnd = addDays(weekStart, 6)

  const [week] = await db
    .select()
    .from(planWeeks)
    .where(
      and(
        eq(planWeeks.planVersionId, active.version.id),
        lte(planWeeks.startDate, date),
        gte(planWeeks.endDate, date),
      ),
    )
    .limit(1)

  // Dates can fall outside the plan (before it starts, after the race), which
  // is a legitimate state rather than an error.
  const weekRows = await db
    .select({ id: planWeeks.id })
    .from(planWeeks)
    .where(
      and(
        eq(planWeeks.planVersionId, active.version.id),
        lte(planWeeks.startDate, weekEnd),
        gte(planWeeks.endDate, weekStart),
      ),
    )

  const rows =
    weekRows.length === 0
      ? []
      : await db
          .select({ workout: workouts, link: workoutActivityLinks, activity: activities })
          .from(workouts)
          .leftJoin(workoutActivityLinks, eq(workoutActivityLinks.workoutId, workouts.id))
          .leftJoin(activities, eq(activities.id, workoutActivityLinks.activityId))
          .where(
            and(
              inArray(workouts.planWeekId, weekRows.map((w) => w.id)),
              gte(workouts.date, weekStart),
              lte(workouts.date, weekEnd),
            ),
          )
          .orderBy(asc(workouts.date), asc(workouts.orderInDay))

  const strip: DayCell[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    const onDay = rows.filter((r) => r.workout.date === d)
    return {
      date: d,
      weekday: i,
      isToday: d === today,
      isPast: d < today,
      types: onDay.map((r) => r.workout.type),
      missed: d < today && onDay.some((r) => r.workout.status === 'SCHEDULED'),
    }
  })

  const weekWorkouts = rows.map((r) => ({ ...r.workout, link: r.link, activity: r.activity }))
  const completed = weekWorkouts.filter((w) => w.status === 'COMPLETED')

  return {
    plan: active.plan,
    week: week ?? null,
    strip,
    selected: weekWorkouts.filter((w) => w.date === date),
    weekWorkouts,
    totals: {
      plannedWorkouts: weekWorkouts.filter((w) => !w.isExtra).length,
      completedWorkouts: completed.length,
      plannedDistanceM: weekWorkouts.reduce((s, w) => s + w.plannedDistanceM, 0),
      completedDistanceM: completed.reduce((s, w) => s + (w.activity?.distanceM ?? w.plannedDistanceM), 0),
    },
    missedThisWeek: weekWorkouts.filter((w) => w.date < today && w.status === 'SCHEDULED').length,
  }
}

/** Recent activity totals, for the mileage-on-track insight. */
export async function getRecentVolume(userId: string, sinceDate: ISODate) {
  const rows = await db
    .select({ distanceM: activities.distanceM, startedAtLocal: activities.startedAtLocal })
    .from(activities)
    .where(and(eq(activities.userId, userId), gte(activities.startedAtLocal, new Date(sinceDate))))
    .orderBy(desc(activities.startedAtLocal))

  return rows
}

export { weekdayOf }
