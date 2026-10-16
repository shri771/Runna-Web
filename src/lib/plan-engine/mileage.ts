/**
 * Weekly volume curve — the thing that changes when the user edits their
 * expected weekly mileage.
 *
 * Two properties matter:
 *  1. the target is a CEILING, not a destination: the curve plateaus at it
 *  2. cutback weeks and the taper are visible in the shape, because users read
 *     the plan overview chart to understand their block
 */

import type { PhasePlan } from './phases'
import { GOAL_DISTANCE_M, PROGRESSION_RATE, type Ability, type Goal, type Progression } from './types'

/** Fraction of peak volume in each taper week, by taper length. */
const TAPER_CURVES: Record<number, number[]> = {
  1: [0.6],
  2: [0.7, 0.5],
  3: [0.75, 0.55, 0.4],
}

const CUTBACK_FACTOR = 0.75

export type MileageInput = {
  phases: PhasePlan
  currentWeeklyKm: number
  targetWeeklyKm?: number
  progression: Progression
  ability: Ability
  goal: Goal
}

export type MileageCurve = {
  /** Target distance in METRES for each week. */
  weeklyM: number[]
  cutbackWeeks: boolean[]
  peakM: number
}

export function buildMileageCurve(input: MileageInput): MileageCurve {
  const { phases, currentWeeklyKm, targetWeeklyKm, progression, ability, goal } = input
  const total = phases.byWeek.length
  if (total === 0) return { weeklyM: [], cutbackWeeks: [], peakM: 0 }

  const rate = PROGRESSION_RATE[progression]
  const cutbackEvery = ability === 'BEGINNER' ? 3 : 4
  const buildableWeeks = total - phases.taperWeeks

  // Uncapped ceiling if the user set no target.
  const ceilingKm = targetWeeklyKm ?? currentWeeklyKm * Math.pow(1 + rate, Math.max(0, buildableWeeks - 1))

  const weeklyKm: number[] = []
  const cutbackWeeks: boolean[] = []
  let previous = currentWeeklyKm
  let peak = currentWeeklyKm

  for (let i = 0; i < buildableWeeks; i++) {
    const raw = i === 0 ? currentWeeklyKm : previous * (1 + rate)
    const capped = Math.min(raw, ceilingKm)

    // A cutback never lands on week 1 or on the last week before the taper —
    // that week should be the peak the runner carries into the taper.
    const isCutback =
      i > 0 && i < buildableWeeks - 1 && (i + 1) % cutbackEvery === 0

    const value = isCutback ? capped * CUTBACK_FACTOR : capped

    weeklyKm.push(round(value))
    cutbackWeeks.push(isCutback)
    // Don't let a cutback suppress the next week's progression.
    previous = capped
    peak = Math.max(peak, value)
  }

  // Taper: fractions of the peak reached.
  const taperCurve = TAPER_CURVES[phases.taperWeeks] ?? []
  for (let i = 0; i < phases.taperWeeks; i++) {
    const factor = taperCurve[i] ?? 0.4
    weeklyKm.push(round(peak * factor))
    cutbackWeeks.push(false)
  }

  // Race week: the race itself plus a little shakeout volume.
  if (goal !== 'BUILD_MILEAGE' && weeklyKm.length === total) {
    const raceKm = GOAL_DISTANCE_M[goal] / 1000
    weeklyKm[total - 1] = round(raceKm + Math.min(8, peak * 0.15))
  }

  return {
    weeklyM: weeklyKm.map((km) => Math.round(km * 1000)),
    cutbackWeeks,
    peakM: Math.round(peak * 1000),
  }
}

/** Round to the nearest 0.5km — plans with 37.4821km weeks look computer-generated. */
const round = (km: number) => Math.round(km * 2) / 2
