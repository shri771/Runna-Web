/**
 * Day assignment.
 *
 * Decide the session MIX for a week, then place it on the days the runner
 * actually has. Placement is a tiny constraint solver: enumerate candidate
 * placements, score each against the training rules, keep the best. With at
 * most 7 days the search space is trivial, and brute force keeps the result
 * deterministic — which matters because the whole engine is snapshot-tested.
 */

import type { Phase, Weekday } from './types'

export type SlotKind = 'LONG' | 'QUALITY' | 'EASY' | 'RECOVERY'

export type SessionSlot = {
  weekday: Weekday
  kind: SlotKind
  /** Index among quality sessions this week — picks which template to use. */
  qualityIndex?: number
}

/** Session mix by days per week. Long run always first. */
export function sessionMix(daysPerWeek: number): SlotKind[] {
  switch (Math.max(2, Math.min(7, daysPerWeek))) {
    case 2:
      return ['LONG', 'QUALITY']
    case 3:
      return ['LONG', 'QUALITY', 'EASY']
    case 4:
      return ['LONG', 'QUALITY', 'EASY', 'EASY']
    case 5:
      return ['LONG', 'QUALITY', 'QUALITY', 'EASY', 'EASY']
    case 6:
      return ['LONG', 'QUALITY', 'QUALITY', 'EASY', 'EASY', 'EASY']
    default:
      return ['LONG', 'QUALITY', 'QUALITY', 'EASY', 'EASY', 'EASY', 'RECOVERY']
  }
}

const isHard = (k: SlotKind) => k === 'QUALITY' || k === 'LONG'

/**
 * Score a placement. Higher is better.
 * Rules, in priority order:
 *   - no two quality sessions on consecutive days      (hard, -100)
 *   - no quality the day immediately before a long run (hard, -60)
 *   - quality sessions spread as far apart as possible (+)
 *   - a rest day after the long run                    (+)
 */
function scorePlacement(assignment: Map<Weekday, SlotKind>): number {
  let score = 0
  const days = [...assignment.keys()].sort((a, b) => a - b)
  const qualityDays = days.filter((d) => assignment.get(d) === 'QUALITY')
  const longDay = days.find((d) => assignment.get(d) === 'LONG')

  for (let i = 0; i < days.length - 1; i++) {
    const a = days[i]!
    const b = days[i + 1]!
    if (b - a !== 1) continue
    const ka = assignment.get(a)!
    const kb = assignment.get(b)!
    if (ka === 'QUALITY' && kb === 'QUALITY') score -= 100
    if (ka === 'QUALITY' && kb === 'LONG') score -= 60
    if (isHard(ka) && isHard(kb)) score -= 20
  }

  if (qualityDays.length === 2) {
    const gap = Math.abs(qualityDays[1]! - qualityDays[0]!)
    score += Math.min(gap, 7 - gap) * 6
  }

  if (longDay !== undefined) {
    const dayAfter = ((longDay + 1) % 7) as Weekday
    if (!assignment.has(dayAfter)) score += 10
  }

  return score
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (items.length < k) return []
  const [head, ...tail] = items
  return [
    ...combinations(tail, k - 1).map((c) => [head!, ...c]),
    ...combinations(tail, k),
  ]
}

export function assignSessionSlots(
  daysPerWeek: number,
  preferredDays: Weekday[],
  longRunDay: Weekday,
  _phase: Phase,
): SessionSlot[] {
  const mix = sessionMix(daysPerWeek)
  const available = [...new Set(preferredDays)].sort((a, b) => a - b)

  // The long run is fixed; everything else competes for the remaining days.
  const longDay = available.includes(longRunDay) ? longRunDay : (available[available.length - 1] ?? 0)
  const others = available.filter((d) => d !== longDay)
  const remaining = mix.filter((k) => k !== 'LONG')
  const needed = Math.min(remaining.length, others.length)

  let best: { assignment: Map<Weekday, SlotKind>; score: number } | null = null

  for (const dayChoice of combinations(others, needed)) {
    // Quality sessions get first pick of the chosen days; try every arrangement
    // of which chosen days are quality.
    const qualityCount = remaining.filter((k) => k === 'QUALITY').length
    for (const qualityDays of combinations(dayChoice, Math.min(qualityCount, dayChoice.length))) {
      const assignment = new Map<Weekday, SlotKind>([[longDay, 'LONG']])
      const leftovers = remaining.filter((k) => k !== 'QUALITY')
      let leftoverIndex = 0

      for (const day of dayChoice) {
        if (qualityDays.includes(day)) assignment.set(day, 'QUALITY')
        else assignment.set(day, leftovers[leftoverIndex++] ?? 'EASY')
      }

      const score = scorePlacement(assignment)
      if (!best || score > best.score) best = { assignment, score }
    }
  }

  const assignment = best?.assignment ?? new Map<Weekday, SlotKind>([[longDay, 'LONG']])

  let qualityIndex = 0
  return [...assignment.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekday, kind]) => ({
      weekday,
      kind,
      qualityIndex: kind === 'QUALITY' ? qualityIndex++ : undefined,
    }))
}
