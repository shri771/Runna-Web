import { describe, expect, it } from 'vitest'
import { AUTO_LINK_THRESHOLD, SUGGEST_THRESHOLD, scoreMatch } from '@/lib/matching'

const workout = {
  date: '2026-10-16',
  plannedDistanceM: 6000,
  estDurationMinS: 2400,
  estDurationMaxS: 2700,
}

const run = (over: Partial<{ day: string; distanceM: number; movingTimeS: number }> = {}) => ({
  startedAtLocal: new Date(`${over.day ?? '2026-10-16'}T06:42:00Z`),
  distanceM: over.distanceM ?? 6120,
  movingTimeS: over.movingTimeS ?? 1908,
})

describe('scoreMatch', () => {
  it('scores a same-day run of the right distance high enough to auto-link', () => {
    expect(scoreMatch(run({ movingTimeS: 2550 }), workout)).toBeGreaterThanOrEqual(AUTO_LINK_THRESHOLD)
  })

  it('refuses anything more than a day away outright', () => {
    expect(scoreMatch(run({ day: '2026-10-18' }), workout)).toBe(0)
    expect(scoreMatch(run({ day: '2026-10-14' }), workout)).toBe(0)
  })

  it('discounts but still considers a neighbouring day', () => {
    const adjacent = scoreMatch(run({ day: '2026-10-17', movingTimeS: 2550 }), workout)
    const sameDay = scoreMatch(run({ movingTimeS: 2550 }), workout)
    expect(adjacent).toBeLessThan(sameDay)
    expect(adjacent).toBeGreaterThan(0)
  })

  it('drops a run of wildly the wrong distance below the suggestion floor', () => {
    expect(scoreMatch(run({ distanceM: 22000, movingTimeS: 7000 }), workout)).toBeLessThan(
      SUGGEST_THRESHOLD,
    )
  })

  it('prefers the closer of two distances on the same day', () => {
    const close = scoreMatch(run({ distanceM: 6050, movingTimeS: 2550 }), workout)
    const loose = scoreMatch(run({ distanceM: 7400, movingTimeS: 2550 }), workout)
    expect(close).toBeGreaterThan(loose)
  })

  it('never returns a score outside 0 to 1', () => {
    const cases = [
      run(),
      run({ distanceM: 1 }),
      run({ distanceM: 90000, movingTimeS: 30000 }),
      run({ movingTimeS: 1 }),
    ]
    for (const c of cases) {
      const score = scoreMatch(c, workout)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })

  it('keeps the thresholds ordered', () => {
    expect(SUGGEST_THRESHOLD).toBeLessThan(AUTO_LINK_THRESHOLD)
  })
})
