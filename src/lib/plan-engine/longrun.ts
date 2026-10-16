/**
 * Long run progression. Capped three ways: by the goal, by the user's own
 * limit, and by a share of the week — a 19km long run inside a 28km week is
 * how people get hurt.
 */

import type { PhasePlan } from './phases'
import { GOAL_DISTANCE_M, type Goal } from './types'

const GOAL_LONG_RUN_CEILING_KM: Record<Goal, number> = {
  FIVE_K: 10,
  TEN_K: 14,
  HALF: 19,
  MARATHON: 32,
  BUILD_MILEAGE: 24,
}

/**
 * Share of weekly volume the long run may take. Fewer running days means the
 * long run is legitimately a bigger slice — pinning a 2-day week to 40% leaves
 * the long run stuck at its floor while weekly volume climbs around it.
 */
function maxShareOfWeek(daysPerWeek: number): number {
  if (daysPerWeek <= 2) return 0.55
  if (daysPerWeek === 3) return 0.5
  return 0.4
}

const TAPER_FACTORS = [0.6, 0.45, 0.3]

export type LongRunInput = {
  phases: PhasePlan
  weeklyM: number[]
  cutbackWeeks: boolean[]
  currentLongestKm: number
  maxLongKm?: number
  daysPerWeek: number
  goal: Goal
}

export function buildLongRunCurve(input: LongRunInput): number[] {
  const { phases, weeklyM, cutbackWeeks, currentLongestKm, maxLongKm, daysPerWeek, goal } = input
  const share = maxShareOfWeek(daysPerWeek)
  const total = phases.byWeek.length
  if (total === 0) return []

  const ceilingKm = Math.min(maxLongKm ?? Infinity, GOAL_LONG_RUN_CEILING_KM[goal])
  const buildableWeeks = total - phases.taperWeeks
  const stepKm = buildableWeeks > 1 ? Math.max(0, (ceilingKm - currentLongestKm) / (buildableWeeks - 1)) : 0

  const out: number[] = []
  let peakKm = currentLongestKm

  for (let i = 0; i < buildableWeeks; i++) {
    const weekKm = (weeklyM[i] ?? 0) / 1000
    let km = Math.min(currentLongestKm + i * stepKm, ceilingKm, weekKm * share)
    if (cutbackWeeks[i]) km *= 0.8
    km = round(Math.max(km, 3))
    out.push(km)
    peakKm = Math.max(peakKm, km)
  }

  for (let i = 0; i < phases.taperWeeks; i++) {
    const factor = TAPER_FACTORS[i] ?? 0.3
    out.push(round(Math.max(3, peakKm * factor)))
  }

  // Race week's "long run" is the race.
  if (goal !== 'BUILD_MILEAGE' && out.length === total) {
    out[total - 1] = round(GOAL_DISTANCE_M[goal] / 1000)
  }

  return out.map((km) => Math.round(km * 1000))
}

const round = (km: number) => Math.round(km * 2) / 2
