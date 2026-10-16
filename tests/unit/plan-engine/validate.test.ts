import { describe, expect, it } from 'vitest'
import { hasBlockingIssue, validate, type PlanRequest } from '@/lib/plan-engine'
import { REQUESTS } from './fixtures'

const codes = (req: PlanRequest) => validate(req).map((i) => i.code)

describe('validate', () => {
  it('accepts the canonical requests without blocking', () => {
    for (const [name, req] of Object.entries(REQUESTS)) {
      expect(hasBlockingIssue(validate(req)), `${name} should not block`).toBe(false)
    }
  })

  it('rejects a race date in the past', () => {
    expect(codes({ ...REQUESTS.intermediateHalf!, raceDate: '2026-10-01' })).toContain('RACE_DATE_PAST')
  })

  it('rejects a plan shorter than the goal minimum', () => {
    const issues = validate({ ...REQUESTS.intermediateHalf!, raceDate: '2026-11-02' })
    expect(issues.map((i) => i.code)).toContain('PLAN_TOO_SHORT')
    expect(hasBlockingIssue(issues)).toBe(true)
  })

  it('rejects fewer preferred days than runs per week', () => {
    expect(codes({ ...REQUESTS.intermediateHalf!, daysPerWeek: 5, preferredDays: [1, 3] }))
      .toContain('PREFERRED_DAYS_MISMATCH')
  })

  it('rejects a long run day the runner cannot run', () => {
    expect(codes({ ...REQUESTS.intermediateHalf!, longRunDay: 4, preferredDays: [0, 2, 3, 5, 6] }))
      .toContain('LONG_RUN_DAY_NOT_AVAILABLE')
  })

  it('rejects a longest run further than the whole week', () => {
    expect(codes({ ...REQUESTS.intermediateHalf!, currentWeeklyKm: 20, currentLongestKm: 25 }))
      .toContain('LONGEST_EXCEEDS_WEEKLY')
  })

  it('rejects a target below current volume', () => {
    expect(codes({ ...REQUESTS.intermediateHalf!, targetWeeklyKm: 20 })).toContain('TARGET_BELOW_CURRENT')
  })

  it('warns, but does not block, on a steep ramp', () => {
    const issues = validate({ ...REQUESTS.intermediateHalf!, targetWeeklyKm: 95, progression: 'AGGRESSIVE' })
    const ramp = issues.find((i) => i.code === 'RAMP_TOO_STEEP')
    expect(ramp?.severity).toBe('warning')
    expect(hasBlockingIssue(issues)).toBe(false)
  })

  it('offers actionable fixes with a steep-ramp warning', () => {
    const ramp = validate({ ...REQUESTS.intermediateHalf!, targetWeeklyKm: 95 })
      .find((i) => i.code === 'RAMP_TOO_STEEP')
    expect(ramp?.suggestions?.length).toBeGreaterThan(0)
    expect(ramp?.suggestions?.[0]?.patch).toBeDefined()
  })

  it('warns when weekly volume is low for the race distance', () => {
    expect(codes({ ...REQUESTS.intermediateHalf!, targetWeeklyKm: 30 }))
      .toContain('TARGET_TOO_LOW_FOR_GOAL')
  })

  it('warns when no pace basis is given', () => {
    const { paceBasis: _omitted, ...rest } = REQUESTS.intermediateHalf!
    expect(codes(rest as PlanRequest)).toContain('NO_PACE_BASIS')
  })

  it('reports every problem at once rather than stopping at the first', () => {
    const issues = validate({
      ...REQUESTS.intermediateHalf!,
      raceDate: '2026-10-01',
      preferredDays: [1],
      currentLongestKm: 99,
    })
    expect(issues.filter((i) => i.severity === 'error').length).toBeGreaterThanOrEqual(3)
  })
})
