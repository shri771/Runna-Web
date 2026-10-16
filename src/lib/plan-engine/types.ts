/**
 * Plan engine — domain types.
 *
 * This module (and everything else in `plan-engine/`) is PURE:
 * no database, no React, no network, no `Date.now()`. Inputs in, plan out.
 * That boundary is what makes the engine testable in isolation.
 */

export type ISODate = string // YYYY-MM-DD

/** 0 = Monday … 6 = Sunday */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export type Goal = 'FIVE_K' | 'TEN_K' | 'HALF' | 'MARATHON' | 'BUILD_MILEAGE'
export type Ability = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
export type Progression = 'GRADUAL' | 'STEADY' | 'AGGRESSIVE'
export type Phase = 'BASE' | 'BUILD' | 'PEAK' | 'TAPER' | 'RACE'

export type WorkoutType =
  | 'RECOVERY'
  | 'EASY'
  | 'LONG'
  | 'TEMPO'
  | 'THRESHOLD'
  | 'INTERVALS'
  | 'RACE_PACE'
  | 'RACE'
  | 'REST'

export type PaceZone =
  | 'INTERVAL'
  | 'FIVE_K'
  | 'TEN_K'
  | 'THRESHOLD'
  | 'MARATHON'
  | 'LONG'
  | 'EASY'
  | 'RECOVERY'

/** Seconds per kilometre, [fastest, slowest]. */
export type PaceRange = readonly [number, number]

export type PaceZones = Record<PaceZone, PaceRange>

export type PaceBasis =
  | { kind: 'RACE_RESULT'; distanceM: number; timeS: number }
  | { kind: 'ESTIMATED_5K'; timeS: number }
  | { kind: 'EASY_PACE'; secPerKm: number }

export type PlanRequest = {
  goal: Goal
  raceDate?: ISODate
  planWeeks?: number
  startDate: ISODate
  raceName?: string

  daysPerWeek: number
  preferredDays: Weekday[]
  longRunDay: Weekday

  ability: Ability
  currentWeeklyKm: number
  currentLongestKm: number

  targetWeeklyKm?: number
  progression: Progression
  maxEasyKm?: number
  maxLongKm?: number
  maxHardKm?: number

  paceBasis?: PaceBasis
  units?: 'KM' | 'MI'
}

export type IssueCode =
  | 'RACE_DATE_PAST'
  | 'RACE_DATE_MISSING'
  | 'PLAN_TOO_SHORT'
  | 'PLAN_TOO_LONG'
  | 'TOO_FEW_DAYS'
  | 'PREFERRED_DAYS_MISMATCH'
  | 'LONG_RUN_DAY_NOT_AVAILABLE'
  | 'LONGEST_EXCEEDS_WEEKLY'
  | 'TARGET_BELOW_CURRENT'
  | 'INVALID_NUMBER'
  | 'RAMP_TOO_STEEP'
  | 'TARGET_TOO_LOW_FOR_GOAL'
  | 'LONG_RUN_GAP'
  | 'NO_PACE_BASIS'

export type PlanIssue = {
  code: IssueCode
  severity: 'error' | 'warning'
  message: string
  field?: keyof PlanRequest
  suggestions?: { label: string; patch: Partial<PlanRequest> }[]
}

/** A single step of a session. `REPEAT` nests, which is why steps are a tree. */
export type WorkoutStep =
  | {
      kind: 'WARMUP' | 'COOLDOWN' | 'RUN' | 'RECOVERY'
      distanceM?: number
      durationS?: number
      zone: PaceZone
      label?: string
    }
  | { kind: 'REPEAT'; count: number; children: WorkoutStep[] }

export type Workout = {
  workoutKey: string
  date: ISODate
  weekNo: number
  weekday: Weekday
  orderInDay: number
  type: WorkoutType
  templateId: string
  name: string
  plannedDistanceM: number
  estDurationMinS: number
  estDurationMaxS: number
  steps: WorkoutStep[]
  isExtra: boolean
}

export type PlanWeek = {
  weekNo: number
  startDate: ISODate
  endDate: ISODate
  phase: Phase
  targetDistanceM: number
  isCutback: boolean
  isTaper: boolean
}

export type Plan = {
  goal: Goal
  startDate: ISODate
  raceDate?: ISODate
  raceName?: string
  totalWeeks: number
  totalDistanceM: number
  peakWeeklyM: number
  longestRunM: number
  paceZones: PaceZones
  weeks: PlanWeek[]
  workouts: Workout[]
  issues: PlanIssue[]
}

/** Metres per goal race. `BUILD_MILEAGE` has no race. */
export const GOAL_DISTANCE_M: Record<Goal, number> = {
  FIVE_K: 5000,
  TEN_K: 10000,
  HALF: 21097,
  MARATHON: 42195,
  BUILD_MILEAGE: 0,
}

export const GOAL_MIN_WEEKS: Record<Goal, number> = {
  FIVE_K: 4,
  TEN_K: 6,
  HALF: 8,
  MARATHON: 12,
  BUILD_MILEAGE: 4,
}

export const GOAL_TAPER_WEEKS: Record<Goal, number> = {
  FIVE_K: 1,
  TEN_K: 1,
  HALF: 2,
  MARATHON: 3,
  BUILD_MILEAGE: 0,
}

export const GOAL_LABEL: Record<Goal, string> = {
  FIVE_K: '5K Plan',
  TEN_K: '10K Plan',
  HALF: 'Half Marathon Plan',
  MARATHON: 'Marathon Plan',
  BUILD_MILEAGE: 'Build Mileage Plan',
}

export const PROGRESSION_RATE: Record<Progression, number> = {
  GRADUAL: 0.04,
  STEADY: 0.07,
  AGGRESSIVE: 0.1,
}

export const MAX_WEEKS = 52
/** Weekly volume increase above which we warn about injury risk. */
export const SAFE_WEEKLY_RAMP = 0.1
