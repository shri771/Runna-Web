/** Pure date helpers over `YYYY-MM-DD` strings. No timezone, no clock. */

import type { ISODate, Weekday } from './types'

export function parseISO(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m || !day) throw new Error(`Invalid ISO date: ${d}`)
  return new Date(Date.UTC(y, m - 1, day))
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: ISODate, n: number): ISODate {
  const date = parseISO(d)
  date.setUTCDate(date.getUTCDate() + n)
  return toISO(date)
}

export function addWeeks(d: ISODate, n: number): ISODate {
  return addDays(d, n * 7)
}

/** 0 = Monday … 6 = Sunday (JS gives 0 = Sunday, so rotate). */
export function weekdayOf(d: ISODate): Weekday {
  return ((parseISO(d).getUTCDay() + 6) % 7) as Weekday
}

export function startOfWeek(d: ISODate): ISODate {
  return addDays(d, -weekdayOf(d))
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000)
}

/** Whole weeks from `a` to `b`, floored. Negative if `b` precedes `a`. */
export function weeksBetween(a: ISODate, b: ISODate): number {
  return Math.floor(daysBetween(a, b) / 7)
}
