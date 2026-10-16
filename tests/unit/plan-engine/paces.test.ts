import { describe, expect, it } from 'vitest'
import {
  PACE_CEILING,
  PACE_FLOOR,
  derivePaceZones,
  equivalent5kTime,
  formatPace,
  riegel,
} from '@/lib/plan-engine'

describe('riegel', () => {
  it('converts a 10K time down to a 5K equivalent', () => {
    // 50:00 10K -> ~23:57 5K
    expect(Math.round(riegel(3000, 10000, 5000))).toBeCloseTo(1437, -1)
  })

  it('converts a 5K time up to a marathon equivalent', () => {
    // 20:00 5K -> ~3:07 marathon
    const marathon = riegel(1200, 5000, 42195)
    expect(marathon / 60).toBeGreaterThan(180)
    expect(marathon / 60).toBeLessThan(195)
  })

  it('is identity at the same distance', () => {
    expect(riegel(1200, 5000, 5000)).toBeCloseTo(1200, 5)
  })

  it('rejects non-positive input', () => {
    expect(() => riegel(0, 5000, 10000)).toThrow()
    expect(() => riegel(1200, 0, 10000)).toThrow()
  })
})

describe('equivalent5kTime', () => {
  it('passes an estimated 5K straight through', () => {
    expect(equivalent5kTime({ kind: 'ESTIMATED_5K', timeS: 1500 }, 'INTERMEDIATE')).toBe(1500)
  })

  it('falls back to an ability default with no basis', () => {
    expect(equivalent5kTime(undefined, 'BEGINNER')).toBe(390 * 5)
    expect(equivalent5kTime(undefined, 'ADVANCED')).toBe(270 * 5)
  })

  it('inverts an easy pace back to roughly 5K pace', () => {
    const zones = derivePaceZones({ kind: 'EASY_PACE', secPerKm: 360 }, 'INTERMEDIATE')
    const [fast, slow] = zones.EASY
    expect(360).toBeGreaterThanOrEqual(fast - 10)
    expect(360).toBeLessThanOrEqual(slow + 10)
  })
})

describe('derivePaceZones', () => {
  const zones = derivePaceZones({ kind: 'ESTIMATED_5K', timeS: 1500 }, 'INTERMEDIATE') // 5:00/km

  it('orders zones from fastest to slowest', () => {
    const order = ['INTERVAL', 'FIVE_K', 'TEN_K', 'THRESHOLD', 'MARATHON', 'EASY', 'RECOVERY'] as const
    for (let i = 0; i < order.length - 1; i++) {
      expect(zones[order[i]!][0]).toBeLessThanOrEqual(zones[order[i + 1]!][0])
    }
  })

  it('gives every zone a non-inverted range', () => {
    for (const [fast, slow] of Object.values(zones)) {
      expect(fast).toBeLessThanOrEqual(slow)
    }
  })

  it('puts interval pace faster than 5K pace and easy pace much slower', () => {
    expect(zones.INTERVAL[0]).toBeLessThan(zones.FIVE_K[0])
    expect(zones.EASY[0]).toBeGreaterThan(zones.FIVE_K[1] + 50)
  })

  it('clamps nonsense input instead of producing impossible paces', () => {
    const absurdlyFast = derivePaceZones({ kind: 'ESTIMATED_5K', timeS: 60 }, 'ADVANCED')
    const absurdlySlow = derivePaceZones({ kind: 'ESTIMATED_5K', timeS: 10_000 }, 'BEGINNER')
    for (const [fast, slow] of [...Object.values(absurdlyFast), ...Object.values(absurdlySlow)]) {
      expect(fast).toBeGreaterThanOrEqual(PACE_FLOOR)
      expect(slow).toBeLessThanOrEqual(PACE_CEILING)
    }
  })
})

describe('formatPace', () => {
  it('formats seconds per km as m:ss', () => {
    expect(formatPace(312)).toBe('5:12')
    expect(formatPace(300)).toBe('5:00')
    expect(formatPace(65)).toBe('1:05')
  })
})
