import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  activities,
  planVersions,
  planWeeks,
  plans,
  stravaConnections,
  workoutActivityLinks,
  workouts,
} from '@/lib/db/schema'
import { AppError } from '@/lib/errors'
import { addDays, type ISODate } from '@/lib/plan-engine'
import { AUTO_LINK_THRESHOLD, SUGGEST_THRESHOLD, grade, scoreMatch } from '@/lib/matching'

/**
 * The Link tab's data, and the link/unlink operations behind it.
 *
 * Matching an activity to the session it was meant to be is scored on date
 * proximity, distance and duration. Anything confident enough links itself;
 * anything plausible is offered for confirmation; the rest waits in the list.
 */

export type Candidate = { workoutId: string; name: string; date: string; plannedDistanceM: number; score: number }

async function planWeekIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: planWeeks.id })
    .from(planWeeks)
    .innerJoin(planVersions, eq(planVersions.id, planWeeks.planVersionId))
    .innerJoin(plans, and(eq(plans.id, planVersions.planId), eq(plans.currentVersionId, planVersions.id)))
    .where(and(eq(plans.userId, userId), eq(plans.status, 'ACTIVE')))
  return rows.map((r) => r.id)
}

export async function getLinkInbox(userId: string, today: ISODate) {
  const [connection] = await db
    .select()
    .from(stravaConnections)
    .where(eq(stravaConnections.userId, userId))
    .limit(1)

  const weekIds = await planWeekIds(userId)

  // Unlinked runs: no row in the link table points at them.
  const unlinked = await db
    .select()
    .from(activities)
    .leftJoin(workoutActivityLinks, eq(workoutActivityLinks.activityId, activities.id))
    .where(and(eq(activities.userId, userId), isNull(workoutActivityLinks.activityId)))
    .orderBy(desc(activities.startedAtLocal))
    .limit(30)

  // Sessions in the past still waiting for a run.
  const waiting =
    weekIds.length === 0
      ? []
      : await db
          .select({ workout: workouts })
          .from(workouts)
          .leftJoin(workoutActivityLinks, eq(workoutActivityLinks.workoutId, workouts.id))
          .where(
            and(
              inArray(workouts.planWeekId, weekIds),
              lte(workouts.date, today),
              eq(workouts.status, 'SCHEDULED'),
              isNull(workoutActivityLinks.workoutId),
            ),
          )
          .orderBy(desc(workouts.date))
          .limit(30)

  const waitingWorkouts = waiting.map((w) => w.workout)

  // Pair each unlinked run with its best waiting session.
  const needsReview: { activity: typeof unlinked[number]['activities']; suggestion: Candidate }[] = []
  const stillUnlinked: typeof unlinked[number]['activities'][] = []

  for (const row of unlinked) {
    const activity = row.activities
    let best: Candidate | null = null
    for (const w of waitingWorkouts) {
      const score = scoreMatch(activity, w)
      if (score >= SUGGEST_THRESHOLD && (!best || score > best.score)) {
        best = {
          workoutId: w.id,
          name: w.name,
          date: w.date,
          plannedDistanceM: w.plannedDistanceM,
          score,
        }
      }
    }
    if (best) needsReview.push({ activity, suggestion: best })
    else stillUnlinked.push(activity)
  }

  return {
    connection: connection ?? null,
    needsReview,
    unlinked: stillUnlinked,
    waiting: waitingWorkouts.filter((w) => !needsReview.some((r) => r.suggestion.workoutId === w.id)),
  }
}

export async function linkActivity(userId: string, workoutId: string, activityId: string, move = false) {
  const weekIds = await planWeekIds(userId)
  if (weekIds.length === 0) throw new AppError('NOT_FOUND', 'That workout does not exist.')

  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), inArray(workouts.planWeekId, weekIds)))
    .limit(1)
  if (!workout) throw new AppError('NOT_FOUND', 'That workout does not exist.')

  const [activity] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
    .limit(1)
  if (!activity) throw new AppError('NOT_FOUND', 'That run does not exist.')

  const [existing] = await db
    .select({ workoutId: workoutActivityLinks.workoutId })
    .from(workoutActivityLinks)
    .where(eq(workoutActivityLinks.activityId, activityId))
    .limit(1)

  if (existing && existing.workoutId !== workoutId) {
    if (!move) {
      const [other] = await db
        .select({ name: workouts.name, date: workouts.date })
        .from(workouts)
        .where(eq(workouts.id, existing.workoutId))
        .limit(1)
      throw new AppError(
        'ACTIVITY_ALREADY_LINKED',
        `That run is already linked to ${other?.name ?? 'another session'}.`,
        { workoutId: existing.workoutId, workoutName: other?.name, workoutDate: other?.date },
      )
    }
    // Moving it: release the old session back to scheduled.
    await db.delete(workoutActivityLinks).where(eq(workoutActivityLinks.activityId, activityId))
    await db.update(workouts).set({ status: 'SCHEDULED' }).where(eq(workouts.id, existing.workoutId))
  }

  const compliance = grade(activity.distanceM, workout.plannedDistanceM)

  await db
    .insert(workoutActivityLinks)
    .values({
      workoutId,
      activityId,
      linkedBy: 'USER',
      matchScore: String(scoreMatch(activity, workout)),
      compliance,
    })
    .onConflictDoUpdate({
      target: workoutActivityLinks.workoutId,
      set: { activityId, linkedBy: 'USER', compliance },
    })

  await db.update(workouts).set({ status: 'COMPLETED' }).where(eq(workouts.id, workoutId))
  return { compliance }
}

export async function unlinkActivity(userId: string, workoutId: string) {
  const weekIds = await planWeekIds(userId)
  if (weekIds.length === 0) throw new AppError('NOT_FOUND', 'That workout does not exist.')

  const [workout] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), inArray(workouts.planWeekId, weekIds)))
    .limit(1)
  if (!workout) throw new AppError('NOT_FOUND', 'That workout does not exist.')

  await db.delete(workoutActivityLinks).where(eq(workoutActivityLinks.workoutId, workoutId))
  await db.update(workouts).set({ status: 'SCHEDULED' }).where(eq(workouts.id, workoutId))
}

/** Candidate sessions for one run, best first. Powers "choose another". */
export async function getCandidates(userId: string, activityId: string) {
  const weekIds = await planWeekIds(userId)
  const [activity] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
    .limit(1)
  if (!activity || weekIds.length === 0) return []

  const date = activity.startedAtLocal.toISOString().slice(0, 10)
  const rows = await db
    .select({ workout: workouts })
    .from(workouts)
    .leftJoin(workoutActivityLinks, eq(workoutActivityLinks.workoutId, workouts.id))
    .where(
      and(
        inArray(workouts.planWeekId, weekIds),
        gte(workouts.date, addDays(date, -7)),
        lte(workouts.date, addDays(date, 7)),
        isNull(workoutActivityLinks.workoutId),
      ),
    )

  return rows
    .map(({ workout }) => ({
      workoutId: workout.id,
      name: workout.name,
      date: workout.date,
      plannedDistanceM: workout.plannedDistanceM,
      score: scoreMatch(activity, workout),
      deltaM: activity.distanceM - workout.plannedDistanceM,
    }))
    .sort((a, b) => b.score - a.score || Math.abs(a.deltaM) - Math.abs(b.deltaM))
}

export { AUTO_LINK_THRESHOLD, SUGGEST_THRESHOLD, scoreMatch }
