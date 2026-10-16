import type { WorkoutType } from '@/lib/plan-engine/types'

/**
 * One source of truth for workout colouring. Used by chips, calendar dots,
 * detail headers and charts, so a type always looks the same everywhere.
 */
export const WORKOUT_COLOR: Record<WorkoutType, string> = {
  RECOVERY: 'var(--color-w-recovery)',
  EASY: 'var(--color-w-easy)',
  LONG: 'var(--color-w-long)',
  TEMPO: 'var(--color-w-tempo)',
  THRESHOLD: 'var(--color-w-threshold)',
  INTERVALS: 'var(--color-w-intervals)',
  RACE_PACE: 'var(--color-w-racepace)',
  RACE: 'var(--color-w-race)',
  REST: 'transparent',
}

export const WORKOUT_LABEL: Record<WorkoutType, string> = {
  RECOVERY: 'Recovery',
  EASY: 'Easy',
  LONG: 'Long run',
  TEMPO: 'Tempo',
  THRESHOLD: 'Threshold',
  INTERVALS: 'Intervals',
  RACE_PACE: 'Race pace',
  RACE: 'Race',
  REST: 'Rest',
}
