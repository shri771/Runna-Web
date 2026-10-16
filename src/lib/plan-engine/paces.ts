/**
 * Training pace derivation.
 *
 * Everything hangs off one number: an equivalent 5K time. Any pace basis is
 * normalised to that via Riegel, then the eight training zones are offsets
 * from 5K pace. Every zone is a RANGE, never a single number — that's what
 * produces honest duration estimates like "40m - 45m".
 */

import type { Ability, PaceBasis, PaceRange, PaceZone, PaceZones } from './types'

/** Riegel's endurance formula: T2 = T1 * (D2/D1)^1.06 */
export const RIEGEL_EXPONENT = 1.06

export function riegel(timeS: number, fromM: number, toM: number): number {
  if (fromM <= 0 || toM <= 0 || timeS <= 0) throw new Error('riegel: inputs must be positive')
  return timeS * Math.pow(toM / fromM, RIEGEL_EXPONENT)
}

/** Fastest and slowest pace (s/km) we will ever prescribe. Clamps garbage input. */
export const PACE_FLOOR = 150 // 2:30/km
export const PACE_CEILING = 600 // 10:00/km

const ABILITY_DEFAULT_5K_PACE: Record<Ability, number> = {
  BEGINNER: 390,
  INTERMEDIATE: 330,
  ADVANCED: 270,
}

/** Offsets from 5K pace, in seconds per km: [fastest, slowest]. */
const ZONE_OFFSETS: Record<PaceZone, PaceRange> = {
  INTERVAL: [-8, -2],
  FIVE_K: [-3, 3],
  TEN_K: [8, 14],
  THRESHOLD: [17, 25],
  MARATHON: [35, 45],
  LONG: [70, 95],
  EASY: [75, 95],
  RECOVERY: [100, 125],
}

/** Mid-point of the EASY offset, used to invert an easy pace back to 5K pace. */
const EASY_MID_OFFSET = (ZONE_OFFSETS.EASY[0] + ZONE_OFFSETS.EASY[1]) / 2

const clampPace = (p: number) => Math.round(Math.min(PACE_CEILING, Math.max(PACE_FLOOR, p)))

/** Normalise any pace basis to an equivalent 5K time in seconds. */
export function equivalent5kTime(basis: PaceBasis | undefined, ability: Ability): number {
  if (!basis) return ABILITY_DEFAULT_5K_PACE[ability] * 5

  switch (basis.kind) {
    case 'ESTIMATED_5K':
      return basis.timeS
    case 'RACE_RESULT':
      return riegel(basis.timeS, basis.distanceM, 5000)
    case 'EASY_PACE':
      // Invert: easy pace = 5k pace + EASY_MID_OFFSET
      return Math.max(0, basis.secPerKm - EASY_MID_OFFSET) * 5
  }
}

/**
 * Build the eight zones. Clamped to sane bounds and forced monotonic, so a
 * nonsense input (a 9-minute 5K) degrades to something runnable rather than
 * producing negative paces downstream.
 */
export function derivePaceZones(basis: PaceBasis | undefined, ability: Ability): PaceZones {
  const p5k = clampPace(equivalent5kTime(basis, ability) / 5)

  const order: PaceZone[] = [
    'INTERVAL',
    'FIVE_K',
    'TEN_K',
    'THRESHOLD',
    'MARATHON',
    'LONG',
    'EASY',
    'RECOVERY',
  ]

  const zones = {} as Record<PaceZone, [number, number]>
  let previousSlowest = 0

  for (const zone of order) {
    const [lo, hi] = ZONE_OFFSETS[zone]
    let fast = clampPace(p5k + lo)
    let slow = clampPace(p5k + hi)

    // Keep zones ordered: a zone never starts faster than the previous ended.
    if (fast < previousSlowest) fast = previousSlowest
    if (slow < fast) slow = fast

    zones[zone] = [fast, slow]
    previousSlowest = fast
  }

  // LONG and EASY overlap by design; don't let the monotonic pass collapse LONG.
  zones.LONG = [clampPace(p5k + ZONE_OFFSETS.LONG[0]), clampPace(p5k + ZONE_OFFSETS.LONG[1])]

  return zones as PaceZones
}

/** Seconds to run `distanceM` at a pace range → [fastest, slowest] duration. */
export function estimateDuration(distanceM: number, pace: PaceRange): [number, number] {
  const km = distanceM / 1000
  return [Math.round(km * pace[0]), Math.round(km * pace[1])]
}

/** 312 → "5:12" */
export function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatPaceRange(pace: PaceRange): string {
  return `${formatPace(pace[0])} – ${formatPace(pace[1])}/km`
}
