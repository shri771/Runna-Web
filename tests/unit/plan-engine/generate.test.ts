import { describe, expect, it } from 'vitest'
import {
  GOAL_DISTANCE_M,
  PROGRESSION_RATE,
  generatePlan,
  stepsDistanceM,
  weekdayOf,
  type Plan,
  type PlanRequest,
} from '@/lib/plan-engine'
import { REQUESTS } from './fixtures'

const plans: Record<string, Plan> = Object.fromEntries(
  Object.entries(REQUESTS).map(([name, req]) => [name, generatePlan(req)]),
)

describe('generatePlan — shape', () => {
  it('produces weeks and workouts for every canonical request', () => {
    for (const [name, plan] of Object.entries(plans)) {
      expect(plan.totalWeeks, name).toBeGreaterThan(0)
      expect(plan.weeks.length, name).toBe(plan.totalWeeks)
      expect(plan.workouts.length, name).toBeGreaterThan(0)
    }
  })

  it('builds a 12-week half marathon plan', () => {
    const plan = plans.intermediateHalf!
    expect(plan.totalWeeks).toBe(12)
    expect(plan.weeks.at(-1)?.phase).toBe('RACE')
    expect(plan.workouts.some((w) => w.type === 'RACE')).toBe(true)
  })

  it('returns no weeks and keeps the issues when input is invalid', () => {
    const plan = generatePlan({ ...REQUESTS.intermediateHalf!, raceDate: '2026-10-13' })
    expect(plan.weeks).toHaveLength(0)
    expect(plan.workouts).toHaveLength(0)
    expect(plan.issues.some((i) => i.severity === 'error')).toBe(true)
  })

  it('is deterministic', () => {
    const a = generatePlan(REQUESTS.intermediateHalf!)
    const b = generatePlan(REQUESTS.intermediateHalf!)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('gives every workout a unique key and a valid date', () => {
    for (const [name, plan] of Object.entries(plans)) {
      const keys = plan.workouts.map((w) => `${w.workoutKey}@${w.date}`)
      expect(new Set(keys).size, name).toBe(keys.length)
      for (const w of plan.workouts) expect(w.date, name).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

describe('generatePlan — invariants', () => {
  it('never exceeds the target weekly mileage', () => {
    for (const [name, req] of Object.entries(REQUESTS)) {
      if (!req.targetWeeklyKm) continue
      const plan = plans[name]!
      const ceiling = req.targetWeeklyKm * 1000
      for (const week of plan.weeks) {
        if (week.phase === 'RACE') continue
        expect(week.targetDistanceM, `${name} week ${week.weekNo}`).toBeLessThanOrEqual(ceiling + 1)
      }
    }
  })

  it('never ramps faster than the chosen progression rate', () => {
    for (const [name, req] of Object.entries(REQUESTS)) {
      const plan = plans[name]!
      const limit = PROGRESSION_RATE[req.progression] + 0.001
      for (let i = 1; i < plan.weeks.length; i++) {
        const prev = plan.weeks[i - 1]!
        const curr = plan.weeks[i]!
        // Cutback weeks dip then recover, and the taper falls away; neither is a ramp.
        if (prev.isCutback || curr.isTaper || prev.isTaper || curr.phase === 'RACE') continue
        if (curr.targetDistanceM <= prev.targetDistanceM) continue
        const ramp = curr.targetDistanceM / prev.targetDistanceM - 1
        // Weekly targets round to the nearest 0.5km, which can nudge a small
        // week fractionally over the rate. Allow exactly that much.
        const rounding = 500 / prev.targetDistanceM
        expect(ramp, `${name} week ${curr.weekNo}`).toBeLessThanOrEqual(limit + rounding)
      }
    }
  })

  it('keeps the long run to a sane share of the week', () => {
    // Fewer running days means the long run is legitimately a bigger slice.
    const bound = (days: number) => (days <= 2 ? 0.68 : days === 3 ? 0.6 : 0.55)
    for (const [name, req] of Object.entries(REQUESTS)) {
      const plan = plans[name]!
      for (const week of plan.weeks) {
        if (week.phase === 'RACE' || week.targetDistanceM === 0) continue
        const longest = Math.max(
          0,
          ...plan.workouts.filter((w) => w.weekNo === week.weekNo).map((w) => w.plannedDistanceM),
        )
        const actualWeek = plan.workouts
          .filter((w) => w.weekNo === week.weekNo)
          .reduce((s, w) => s + w.plannedDistanceM, 0)
        expect(longest / actualWeek, `${name} week ${week.weekNo}`).toBeLessThanOrEqual(
          bound(req.daysPerWeek),
        )
      }
    }
  })

  it('never schedules two quality sessions on consecutive days', () => {
    const hard = new Set(['INTERVALS', 'THRESHOLD', 'TEMPO', 'RACE_PACE'])
    for (const [name, plan] of Object.entries(plans)) {
      const byWeek = new Map<number, typeof plan.workouts>()
      for (const w of plan.workouts) {
        byWeek.set(w.weekNo, [...(byWeek.get(w.weekNo) ?? []), w])
      }
      for (const [weekNo, list] of byWeek) {
        const hardDays = list.filter((w) => hard.has(w.type)).map((w) => w.weekday).sort((a, b) => a - b)
        for (let i = 0; i < hardDays.length - 1; i++) {
          expect(hardDays[i + 1]! - hardDays[i]!, `${name} week ${weekNo}`).toBeGreaterThan(1)
        }
      }
    }
  })

  it('only schedules workouts on days the runner said they can run', () => {
    for (const [name, req] of Object.entries(REQUESTS)) {
      const plan = plans[name]!
      const allowed = new Set(req.preferredDays)
      for (const w of plan.workouts) {
        // Race day is dictated by the race, not by preference.
        if (w.type === 'RACE') continue
        expect(allowed.has(w.weekday), `${name} ${w.name} on day ${w.weekday}`).toBe(true)
      }
    }
  })

  it('runs no more sessions per week than requested', () => {
    for (const [name, req] of Object.entries(REQUESTS)) {
      const plan = plans[name]!
      for (const week of plan.weeks) {
        if (week.phase === 'RACE') continue
        const count = plan.workouts.filter((w) => w.weekNo === week.weekNo).length
        expect(count, `${name} week ${week.weekNo}`).toBeLessThanOrEqual(req.daysPerWeek)
      }
    }
  })

  it('never lets one quality session dominate the week', () => {
    const hard = new Set(['INTERVALS', 'THRESHOLD', 'TEMPO', 'RACE_PACE'])
    for (const [name, plan] of Object.entries(plans)) {
      for (const week of plan.weeks) {
        if (week.phase === 'RACE') continue
        const list = plan.workouts.filter((w) => w.weekNo === week.weekNo)
        const actual = list.reduce((s, w) => s + w.plannedDistanceM, 0)
        for (const w of list.filter((w) => hard.has(w.type))) {
          expect(w.plannedDistanceM / actual, `${name} wk${week.weekNo} ${w.name}`).toBeLessThanOrEqual(0.5)
        }
      }
    }
  })

  it('matches each workout distance to the sum of its steps', () => {
    for (const [name, plan] of Object.entries(plans)) {
      for (const w of plan.workouts) {
        expect(Math.abs(stepsDistanceM(w.steps) - w.plannedDistanceM), `${name} ${w.name}`).toBeLessThanOrEqual(50)
      }
    }
  })

  it('gives every workout a positive, ordered duration estimate', () => {
    for (const [name, plan] of Object.entries(plans)) {
      for (const w of plan.workouts) {
        expect(w.estDurationMinS, `${name} ${w.name}`).toBeGreaterThan(0)
        expect(w.estDurationMaxS, `${name} ${w.name}`).toBeGreaterThan(w.estDurationMinS - 1)
      }
    }
  })

  it('respects the per-type distance caps', () => {
    const req = REQUESTS.mileageCappedHalf!
    const plan = plans.mileageCappedHalf!
    for (const w of plan.workouts) {
      if (w.type === 'EASY') expect(w.plannedDistanceM).toBeLessThanOrEqual(req.maxEasyKm! * 1000 + 50)
      if (w.type === 'LONG') expect(w.plannedDistanceM).toBeLessThanOrEqual(req.maxLongKm! * 1000 + 50)
    }
  })
})

describe('generatePlan — periodisation', () => {
  it('moves through base, build, peak and taper in order', () => {
    const phases = plans.advancedMarathon!.weeks.map((w) => w.phase)
    const firstIndexOf = (p: string) => phases.indexOf(p as never)
    expect(firstIndexOf('BASE')).toBe(0)
    expect(firstIndexOf('BUILD')).toBeGreaterThan(firstIndexOf('BASE'))
    expect(firstIndexOf('PEAK')).toBeGreaterThan(firstIndexOf('BUILD'))
    expect(firstIndexOf('TAPER')).toBeGreaterThan(firstIndexOf('PEAK'))
  })

  it('tapers volume before the race', () => {
    const plan = plans.intermediateHalf!
    const taper = plan.weeks.filter((w) => w.isTaper)
    expect(taper.length).toBeGreaterThan(0)
    for (const week of taper) expect(week.targetDistanceM).toBeLessThan(plan.peakWeeklyM)
  })

  it('includes cutback weeks in any plan long enough to need them', () => {
    expect(plans.advancedMarathon!.weeks.some((w) => w.isCutback)).toBe(true)
  })

  it('puts race day on the actual race date', () => {
    for (const [name, req] of Object.entries(REQUESTS)) {
      if (!req.raceDate) continue
      const race = plans[name]!.workouts.find((w) => w.type === 'RACE')
      expect(race?.date, name).toBe(req.raceDate)
      expect(race?.weekday, name).toBe(weekdayOf(req.raceDate))
    }
  })

  it('makes race day the race distance', () => {
    const plan = plans.intermediateHalf!
    const race = plan.workouts.find((w) => w.type === 'RACE')!
    const raceStep = race.steps.find((s) => s.kind === 'RUN')!
    expect('distanceM' in raceStep && raceStep.distanceM).toBe(GOAL_DISTANCE_M.HALF)
  })
})

describe('generatePlan — the customisation workflow', () => {
  const base = REQUESTS.intermediateHalf!

  it('lowers total volume when the user lowers their target', () => {
    const high = generatePlan({ ...base, targetWeeklyKm: 45 })
    const low = generatePlan({ ...base, targetWeeklyKm: 32 })
    expect(low.totalDistanceM).toBeLessThan(high.totalDistanceM)
    expect(low.peakWeeklyM).toBeLessThan(high.peakWeeklyM)
  })

  it('plateaus at the target rather than overshooting it', () => {
    const plan = generatePlan({ ...base, targetWeeklyKm: 32, progression: 'AGGRESSIVE' })
    const nonRace = plan.weeks.filter((w) => w.phase !== 'RACE')
    expect(Math.max(...nonRace.map((w) => w.targetDistanceM))).toBeLessThanOrEqual(32_000)
  })

  it('produces more sessions when the user adds training days', () => {
    const four = generatePlan({ ...base, daysPerWeek: 4, preferredDays: [1, 3, 4, 6] })
    const six = generatePlan({ ...base, daysPerWeek: 6, preferredDays: [0, 1, 2, 3, 4, 6] })
    expect(six.workouts.length).toBeGreaterThan(four.workouts.length)
  })

  it('moves every long run when the long run day changes', () => {
    const sunday = generatePlan({ ...base, longRunDay: 6 })
    const saturday = generatePlan({ ...base, longRunDay: 5, preferredDays: [0, 2, 3, 5, 6] })
    expect(sunday.workouts.filter((w) => w.type === 'LONG').every((w) => w.weekday === 6)).toBe(true)
    expect(saturday.workouts.filter((w) => w.type === 'LONG').every((w) => w.weekday === 5)).toBe(true)
  })

  it('builds slower on gradual than on aggressive', () => {
    const gradual = generatePlan({ ...base, progression: 'GRADUAL', targetWeeklyKm: undefined })
    const aggressive = generatePlan({ ...base, progression: 'AGGRESSIVE', targetWeeklyKm: undefined })
    expect(gradual.peakWeeklyM).toBeLessThan(aggressive.peakWeeklyM)
  })
})

describe('generatePlan — edge cases', () => {
  it('handles the minimum two days a week', () => {
    const plan = plans.twoDaysPerWeek!
    for (const week of plan.weeks) {
      if (week.phase === 'RACE') continue
      expect(plan.workouts.filter((w) => w.weekNo === week.weekNo).length).toBeLessThanOrEqual(2)
    }
  })

  it('handles a no-race mileage plan', () => {
    const plan = plans.buildMileage!
    expect(plan.totalWeeks).toBe(8)
    expect(plan.workouts.some((w) => w.type === 'RACE')).toBe(false)
    expect(plan.raceDate).toBeUndefined()
  })

  it('handles the shortest allowed plan', () => {
    const plan = generatePlan({
      ...REQUESTS.beginner5k!,
      startDate: '2026-10-19',
      raceDate: '2026-11-15',
    })
    expect(plan.issues.some((i) => i.severity === 'error')).toBe(false)
    expect(plan.totalWeeks).toBeGreaterThanOrEqual(4)
  })

  it('still generates a plan with no pace basis at all', () => {
    const { paceBasis: _omitted, ...rest } = REQUESTS.intermediateHalf!
    const plan = generatePlan(rest as PlanRequest)
    expect(plan.workouts.length).toBeGreaterThan(0)
    expect(plan.issues.some((i) => i.code === 'NO_PACE_BASIS')).toBe(true)
  })
})
