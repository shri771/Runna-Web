import type { PaceZone, WorkoutStep } from '@/lib/plan-engine/types'

/**
 * Flatten a step tree into bars for the session silhouette.
 *
 * The signature element of the app: every workout drawn as its own intensity
 * profile over its distance. Pyramid intervals look like a pyramid, a tempo
 * shows two plateaus, an easy run is a flat line. The data already lives in
 * `workouts.steps`, so this is free to compute.
 */

/** Relative effort per zone, 0-1. Not pace — perceived intensity. */
const INTENSITY: Record<PaceZone, number> = {
  RECOVERY: 0.18,
  EASY: 0.32,
  LONG: 0.4,
  MARATHON: 0.56,
  THRESHOLD: 0.72,
  TEN_K: 0.82,
  FIVE_K: 0.92,
  INTERVAL: 1,
}

export type SilhouetteBar = {
  /** Share of total distance, 0-1. */
  width: number
  /** Relative effort, 0-1. */
  height: number
  zone: PaceZone
}

export function silhouette(steps: WorkoutStep[]): SilhouetteBar[] {
  const flat: { distanceM: number; zone: PaceZone }[] = []

  const walk = (list: WorkoutStep[], times: number) => {
    for (const step of list) {
      if (step.kind === 'REPEAT') {
        for (let i = 0; i < step.count * times; i++) walk(step.children, 1)
        continue
      }
      // Duration-only steps still need a footprint; 1 minute ~ 200m is close
      // enough for a thumbnail and keeps the profile readable.
      const distanceM = step.distanceM ?? Math.round(((step.durationS ?? 0) / 60) * 200)
      if (distanceM > 0) flat.push({ distanceM, zone: step.zone })
    }
  }
  walk(steps, 1)

  const total = flat.reduce((sum, s) => sum + s.distanceM, 0)
  if (total === 0) return []

  return flat.map((s) => ({
    width: s.distanceM / total,
    height: INTENSITY[s.zone],
    zone: s.zone,
  }))
}
