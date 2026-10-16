/** Periodisation: split the available weeks into base / build / peak / taper. */

import { GOAL_TAPER_WEEKS, type Goal, type Phase } from './types'

export type PhasePlan = {
  /** Phase for each week, index 0 = week 1. */
  byWeek: Phase[]
  baseWeeks: number
  buildWeeks: number
  peakWeeks: number
  taperWeeks: number
}

const BASE_SHARE = 0.35
const BUILD_SHARE = 0.3
const PEAK_SHARE = 0.2

/**
 * @param extendBase add a week to base at build's expense (used when the
 *                   runner's longest run is far short of the race distance)
 */
export function buildPhases(totalWeeks: number, goal: Goal, extendBase = false): PhasePlan {
  if (totalWeeks <= 0) {
    return { byWeek: [], baseWeeks: 0, buildWeeks: 0, peakWeeks: 0, taperWeeks: 0 }
  }

  const isRace = goal !== 'BUILD_MILEAGE'
  // The last week of a race plan is race week; it sits inside the taper.
  let taperWeeks = isRace ? Math.min(GOAL_TAPER_WEEKS[goal], Math.max(1, totalWeeks - 2)) : 0

  const remaining = totalWeeks - taperWeeks
  let baseWeeks = Math.max(1, Math.floor(remaining * BASE_SHARE))
  let buildWeeks = Math.max(1, Math.floor(remaining * BUILD_SHARE))
  let peakWeeks = Math.max(1, Math.floor(remaining * PEAK_SHARE))

  // Give the remainder to base — aerobic volume is never the wrong answer.
  const assigned = baseWeeks + buildWeeks + peakWeeks
  if (assigned < remaining) baseWeeks += remaining - assigned

  // Very short plans can over-assign; trim from peak, then build, then base.
  let overflow = baseWeeks + buildWeeks + peakWeeks - remaining
  while (overflow > 0) {
    if (peakWeeks > 1) peakWeeks--
    else if (buildWeeks > 1) buildWeeks--
    else if (baseWeeks > 1) baseWeeks--
    else if (taperWeeks > 1) taperWeeks--
    else break
    overflow--
  }

  if (extendBase && buildWeeks > 1) {
    baseWeeks++
    buildWeeks--
  }

  const byWeek: Phase[] = []
  for (let i = 0; i < baseWeeks; i++) byWeek.push('BASE')
  for (let i = 0; i < buildWeeks; i++) byWeek.push('BUILD')
  for (let i = 0; i < peakWeeks; i++) byWeek.push('PEAK')
  for (let i = 0; i < taperWeeks; i++) byWeek.push('TAPER')

  // Final week of a race plan is race week.
  if (isRace && byWeek.length > 0) byWeek[byWeek.length - 1] = 'RACE'
  while (byWeek.length < totalWeeks) byWeek.push(isRace ? 'RACE' : 'BASE')

  return { byWeek: byWeek.slice(0, totalWeeks), baseWeeks, buildWeeks, peakWeeks, taperWeeks }
}
