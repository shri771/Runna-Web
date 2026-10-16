/**
 * The ONLY place distance and pace are converted for display.
 * The database is always metric; `units` is a presentation concern.
 */

export type Units = 'KM' | 'MI'

const M_PER_MI = 1609.344

export function formatDistance(metres: number, units: Units = 'KM', decimals?: number): string {
  if (units === 'MI') {
    const mi = metres / M_PER_MI
    return `${trim(mi, decimals ?? (mi < 10 ? 2 : 1))}mi`
  }
  const km = metres / 1000
  return `${trim(km, decimals ?? (km % 1 === 0 ? 0 : 1))}km`
}

/** Seconds per km in, display pace out. */
export function formatPace(secPerKm: number, units: Units = 'KM'): string {
  const sec = units === 'MI' ? secPerKm * (M_PER_MI / 1000) : secPerKm
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}/${units === 'MI' ? 'mi' : 'km'}`
}

export function formatPaceRange(range: readonly [number, number], units: Units = 'KM'): string {
  const unit = units === 'MI' ? 'mi' : 'km'
  return `${stripUnit(formatPace(range[0], units))} – ${stripUnit(formatPace(range[1], units))}/${unit}`
}

/** 1908 → "31:48"; 5400 → "1:30:00" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** The "40m – 45m" estimate on a workout card. */
export function formatDurationEstimate(minS: number, maxS: number): string {
  const toMin = (s: number) => Math.round(s / 60)
  const lo = toMin(minS)
  const hi = toMin(maxS)
  return lo === hi ? `${lo}m` : `${lo}m – ${hi}m`
}

export const kmToM = (km: number) => Math.round(km * 1000)
export const mToKm = (m: number) => m / 1000

const trim = (n: number, decimals: number) => Number(n.toFixed(decimals)).toString()
const stripUnit = (pace: string) => pace.split('/')[0]!
