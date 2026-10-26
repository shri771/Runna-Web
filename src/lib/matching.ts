/**
 * Activity-to-workout match scoring.
 *
 * Pure, and deliberately in its own module with no database import, so it can
 * be unit-tested in isolation — the same boundary the plan engine keeps.
 */

const DAY_MS = 86_400_000

/** At or above this, link without asking. */
export const AUTO_LINK_THRESHOLD = 0.75
/** Below this, not worth proposing. */
export const SUGGEST_THRESHOLD = 0.45

export type ScorableActivity = { startedAtLocal: Date; distanceM: number; movingTimeS: number }
export type ScorableWorkout = {
  date: string
  plannedDistanceM: number
  estDurationMinS: number
  estDurationMaxS: number
}

export function scoreMatch(activity: ScorableActivity, workout: ScorableWorkout): number {
  const activityDate = activity.startedAtLocal.toISOString().slice(0, 10)
  const dayGap = Math.abs(
    (Date.parse(`${activityDate}T00:00:00Z`) - Date.parse(`${workout.date}T00:00:00Z`)) / DAY_MS,
  )
  // More than a day apart is not the same session, whatever the distance says.
  if (dayGap > 1) return 0

  const dateScore = dayGap === 0 ? 1 : 0.45
  const distanceScore = clamp(
    1 - Math.abs(activity.distanceM - workout.plannedDistanceM) / Math.max(1, workout.plannedDistanceM),
  )
  const estMid = (workout.estDurationMinS + workout.estDurationMaxS) / 2
  const durationScore = clamp(1 - Math.abs(activity.movingTimeS - estMid) / Math.max(1, estMid))

  return Number((0.4 * dateScore + 0.35 * distanceScore + 0.25 * durationScore).toFixed(2))
}

/** How closely the run delivered what was asked for. */
export function grade(actualM: number, plannedM: number): 'NAILED' | 'CLOSE' | 'OFF' {
  const ratio = actualM / Math.max(1, plannedM)
  if (ratio > 0.97 && ratio < 1.03) return 'NAILED'
  if (ratio > 0.9 && ratio < 1.1) return 'CLOSE'
  return 'OFF'
}

const clamp = (n: number) => Math.min(1, Math.max(0, n))
