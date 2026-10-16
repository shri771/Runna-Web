/**
 * Input guards.
 *
 * Returns issues rather than throwing: the wizard needs to show every problem
 * at once, and needs to distinguish blockers (errors) from advice (warnings).
 * Warnings are overridable by the user; errors are not.
 */

import { daysBetween, weeksBetween } from './dates'
import {
  GOAL_DISTANCE_M,
  GOAL_MIN_WEEKS,
  MAX_WEEKS,
  PROGRESSION_RATE,
  SAFE_WEEKLY_RAMP,
  type PlanIssue,
  type PlanRequest,
} from './types'

export function totalWeeksFor(req: PlanRequest): number {
  if (req.goal === 'BUILD_MILEAGE') return req.planWeeks ?? 0
  if (!req.raceDate) return 0
  // Inclusive of race week.
  return Math.max(0, weeksBetween(req.startDate, req.raceDate) + 1)
}

export function validate(req: PlanRequest): PlanIssue[] {
  const issues: PlanIssue[] = []
  const err = (i: Omit<PlanIssue, 'severity'>) => issues.push({ ...i, severity: 'error' })
  const warn = (i: Omit<PlanIssue, 'severity'>) => issues.push({ ...i, severity: 'warning' })

  // --- numbers must be sane before anything else is meaningful ---
  const positives: [keyof PlanRequest, number][] = [
    ['currentWeeklyKm', req.currentWeeklyKm],
    ['currentLongestKm', req.currentLongestKm],
  ]
  for (const [field, value] of positives) {
    if (!Number.isFinite(value) || value < 0) {
      err({ code: 'INVALID_NUMBER', message: `${field} must be a positive number.`, field })
    }
  }

  // --- timing ---
  if (req.goal === 'BUILD_MILEAGE') {
    if (!req.planWeeks) {
      err({ code: 'PLAN_TOO_SHORT', message: 'Choose how many weeks to train for.', field: 'planWeeks' })
    }
  } else if (!req.raceDate) {
    err({ code: 'RACE_DATE_MISSING', message: 'Pick your race date.', field: 'raceDate' })
  } else if (daysBetween(req.startDate, req.raceDate) <= 0) {
    err({ code: 'RACE_DATE_PAST', message: 'Your race date must be in the future.', field: 'raceDate' })
  }

  const weeks = totalWeeksFor(req)
  const minWeeks = GOAL_MIN_WEEKS[req.goal]

  if (weeks > 0 && weeks < minWeeks) {
    err({
      code: 'PLAN_TOO_SHORT',
      message: `A ${label(req)} plan needs at least ${minWeeks} weeks. That date is ${weeks} week${weeks === 1 ? '' : 's'} away.`,
      field: req.goal === 'BUILD_MILEAGE' ? 'planWeeks' : 'raceDate',
    })
  }
  if (weeks > MAX_WEEKS) {
    err({
      code: 'PLAN_TOO_LONG',
      message: `Plans are capped at ${MAX_WEEKS} weeks. That date is ${weeks} weeks away.`,
      field: req.goal === 'BUILD_MILEAGE' ? 'planWeeks' : 'raceDate',
    })
  }

  // --- schedule ---
  if (req.daysPerWeek < 2 || req.daysPerWeek > 7) {
    err({ code: 'TOO_FEW_DAYS', message: 'Choose between 2 and 7 running days a week.', field: 'daysPerWeek' })
  }
  if (req.preferredDays.length < req.daysPerWeek) {
    err({
      code: 'PREFERRED_DAYS_MISMATCH',
      message: `Pick at least ${req.daysPerWeek} day${req.daysPerWeek === 1 ? '' : 's'} you can run.`,
      field: 'preferredDays',
    })
  }
  if (!req.preferredDays.includes(req.longRunDay)) {
    err({
      code: 'LONG_RUN_DAY_NOT_AVAILABLE',
      message: 'Your long run day has to be one of the days you can run.',
      field: 'longRunDay',
    })
  }

  // --- current fitness ---
  if (req.currentLongestKm > req.currentWeeklyKm) {
    err({
      code: 'LONGEST_EXCEEDS_WEEKLY',
      message: "Your longest run can't be further than your whole week.",
      field: 'currentLongestKm',
    })
  }

  // --- volume target ---
  const target = req.targetWeeklyKm
  if (target !== undefined) {
    if (target < req.currentWeeklyKm) {
      err({
        code: 'TARGET_BELOW_CURRENT',
        message: `Your target (${target}km) is below what you already run (${req.currentWeeklyKm}km).`,
        field: 'targetWeeklyKm',
        suggestions: [{ label: `Set target to ${Math.ceil(req.currentWeeklyKm * 1.2)}km`, patch: { targetWeeklyKm: Math.ceil(req.currentWeeklyKm * 1.2) } }],
      })
    } else if (weeks > 1 && req.currentWeeklyKm > 0) {
      // Build phase is everything before the taper.
      const buildWeeks = Math.max(1, weeks - 2)
      const required = Math.pow(target / req.currentWeeklyKm, 1 / buildWeeks) - 1
      if (required > SAFE_WEEKLY_RAMP) {
        const safe = Math.floor(req.currentWeeklyKm * Math.pow(1 + SAFE_WEEKLY_RAMP, buildWeeks))
        warn({
          code: 'RAMP_TOO_STEEP',
          message: `Reaching ${target}km needs a ${(required * 100).toFixed(0)}% weekly increase. Above 10% a week raises injury risk.`,
          field: 'targetWeeklyKm',
          suggestions: [
            { label: `Lower target to ${safe}km`, patch: { targetWeeklyKm: safe } },
            { label: 'Build gradually (+4%/wk)', patch: { progression: 'GRADUAL' } },
          ],
        })
      } else if (required > PROGRESSION_RATE[req.progression]) {
        // Target is reachable but not at the chosen rate; nudge rather than warn.
        const needed = required > PROGRESSION_RATE.STEADY ? 'AGGRESSIVE' : 'STEADY'
        warn({
          code: 'RAMP_TOO_STEEP',
          message: `At ${(PROGRESSION_RATE[req.progression] * 100).toFixed(0)}%/week you won't reach ${target}km before your race.`,
          field: 'progression',
          suggestions: [{ label: `Build faster (${needed.toLowerCase()})`, patch: { progression: needed as PlanRequest['progression'] } }],
        })
      }
    }
  }

  // --- goal-appropriate volume ---
  const raceKm = GOAL_DISTANCE_M[req.goal] / 1000
  const peak = target ?? req.currentWeeklyKm
  if ((req.goal === 'HALF' || req.goal === 'MARATHON') && peak < raceKm * 1.5) {
    warn({
      code: 'TARGET_TOO_LOW_FOR_GOAL',
      message: `${Math.round(raceKm)}km races usually need at least ${Math.ceil(raceKm * 1.5)}km a week. You can still train at ${Math.round(peak)}km, but expect it to be hard on the day.`,
      field: 'targetWeeklyKm',
    })
  }
  if (raceKm > 0 && req.currentLongestKm < raceKm * 0.3) {
    warn({
      code: 'LONG_RUN_GAP',
      message: `Your longest run (${req.currentLongestKm}km) is well short of ${Math.round(raceKm)}km. We'll spend an extra week building base.`,
      field: 'currentLongestKm',
    })
  }

  if (!req.paceBasis) {
    warn({
      code: 'NO_PACE_BASIS',
      message: 'Without a recent race time we estimate your paces from your ability level. You can refine this later.',
      field: 'paceBasis',
    })
  }

  return issues
}

export const hasBlockingIssue = (issues: PlanIssue[]) => issues.some((i) => i.severity === 'error')

function label(req: PlanRequest): string {
  return { FIVE_K: '5K', TEN_K: '10K', HALF: 'half marathon', MARATHON: 'marathon', BUILD_MILEAGE: 'mileage' }[req.goal]
}
