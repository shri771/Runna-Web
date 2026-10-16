/**
 * Workout templates.
 *
 * Each template is a function of the volume it's handed, not a hardcoded
 * session — so the same `tempo_2_1_1` scales from a 5km week-2 version to an
 * 8km week-9 version without a second template.
 */

import type { PaceZones, WorkoutStep, WorkoutType } from '../types'

export type TemplateContext = {
  targetM: number
  zones: PaceZones
  weekNo: number
}

export type TemplateResult = {
  templateId: string
  name: string
  type: WorkoutType
  steps: WorkoutStep[]
}

export type Template = {
  id: string
  type: WorkoutType
  /** Lower bound of total distance this template makes sense at, in metres. */
  minM: number
  build: (ctx: TemplateContext) => TemplateResult
}

const m = (n: number) => Math.round(n / 100) * 100

/** Sum the distance of a step tree, expanding repeats. */
export function stepsDistanceM(steps: WorkoutStep[]): number {
  return steps.reduce((total, step) => {
    if (step.kind === 'REPEAT') return total + step.count * stepsDistanceM(step.children)
    return total + (step.distanceM ?? 0)
  }, 0)
}

// ---------------------------------------------------------------- steady runs

const easyRun: Template = {
  id: 'easy_run',
  type: 'EASY',
  minM: 2000,
  build: ({ targetM }) => ({
    templateId: 'easy_run',
    name: `${fmt(targetM)} Easy Run`,
    type: 'EASY',
    steps: [{ kind: 'RUN', distanceM: targetM, zone: 'EASY', label: 'Easy' }],
  }),
}

const recoveryRun: Template = {
  id: 'recovery_run',
  type: 'RECOVERY',
  minM: 2000,
  build: ({ targetM }) => ({
    templateId: 'recovery_run',
    name: `${fmt(targetM)} Recovery Run`,
    type: 'RECOVERY',
    steps: [{ kind: 'RUN', distanceM: targetM, zone: 'RECOVERY', label: 'Very easy' }],
  }),
}

const longRun: Template = {
  id: 'long_run',
  type: 'LONG',
  minM: 5000,
  build: ({ targetM }) => ({
    templateId: 'long_run',
    name: `${fmt(targetM)} Long Run`,
    type: 'LONG',
    steps: [{ kind: 'RUN', distanceM: targetM, zone: 'LONG', label: 'Steady' }],
  }),
}

const racePaceLong: Template = {
  id: 'race_pace_long',
  type: 'RACE_PACE',
  minM: 10000,
  build: ({ targetM }) => {
    const atPace = m(targetM * 0.35)
    const rest = targetM - atPace
    return {
      templateId: 'race_pace_long',
      name: `${fmt(targetM)} Long Run with Race Pace`,
      type: 'RACE_PACE',
      steps: [
        { kind: 'WARMUP', distanceM: m(rest * 0.6), zone: 'LONG', label: 'Steady' },
        { kind: 'RUN', distanceM: atPace, zone: 'MARATHON', label: 'Race pace' },
        { kind: 'COOLDOWN', distanceM: rest - m(rest * 0.6), zone: 'LONG', label: 'Steady' },
      ],
    }
  },
}

// ------------------------------------------------------------------- quality

const strides: Template = {
  id: 'strides',
  type: 'EASY',
  minM: 4000,
  build: ({ targetM }) => {
    // 6 x (100m stride + 100m walk back) = 1200m, so the easy body absorbs it
    // and the session totals exactly what was asked for.
    const body = Math.max(2000, targetM - 1200)
    return {
      templateId: 'strides',
      name: `${fmt(targetM)} Easy Run with Strides`,
      type: 'EASY',
      steps: [
        { kind: 'RUN', distanceM: body, zone: 'EASY', label: 'Easy' },
        { kind: 'REPEAT', count: 6, children: [
          { kind: 'RUN', distanceM: 100, zone: 'FIVE_K', label: 'Stride' },
          { kind: 'RECOVERY', distanceM: 100, zone: 'RECOVERY', label: 'Walk back' },
        ] },
      ],
    }
  },
}

const fartlek: Template = {
  id: 'fartlek',
  type: 'TEMPO',
  minM: 5000,
  build: ({ targetM }) => {
    const reps = Math.max(5, Math.min(10, Math.floor((targetM - 3000) / 600)))
    const warm = m((targetM - reps * 600) / 2)
    return {
      templateId: 'fartlek',
      name: `${reps} x 2min Fartlek`,
      type: 'TEMPO',
      steps: [
        { kind: 'WARMUP', distanceM: warm, zone: 'EASY', label: 'Warm up' },
        { kind: 'REPEAT', count: reps, children: [
          { kind: 'RUN', distanceM: 400, zone: 'TEN_K', label: 'Pick it up' },
          { kind: 'RECOVERY', distanceM: 200, zone: 'RECOVERY', label: 'Float' },
        ] },
        { kind: 'COOLDOWN', distanceM: targetM - warm - reps * 600, zone: 'EASY', label: 'Cool down' },
      ],
    }
  },
}

const shortTempo: Template = {
  id: 'short_tempo',
  type: 'TEMPO',
  minM: 5000,
  build: ({ targetM }) => {
    const tempo = m(targetM * 0.35)
    const warm = m((targetM - tempo) / 2)
    return {
      templateId: 'short_tempo',
      name: `${fmt(targetM)} Tempo Run`,
      type: 'TEMPO',
      steps: [
        { kind: 'WARMUP', distanceM: warm, zone: 'EASY', label: 'Warm up' },
        { kind: 'RUN', distanceM: tempo, zone: 'THRESHOLD', label: 'Tempo' },
        { kind: 'COOLDOWN', distanceM: targetM - warm - tempo, zone: 'EASY', label: 'Cool down' },
      ],
    }
  },
}

/** The `Tempo 2-1-1` from the reference screenshots. */
const tempo211: Template = {
  id: 'tempo_2_1_1',
  type: 'TEMPO',
  minM: 5000,
  build: ({ targetM }) => {
    const unit = Math.min(2000, Math.max(1000, m((targetM - 2500) / 4)))
    const work = unit * 2 + unit + unit
    const warm = m(Math.max(1000, (targetM - work) * 0.65))
    const cool = Math.max(500, targetM - warm - work)
    return {
      templateId: 'tempo_2_1_1',
      name: 'Tempo 2-1-1',
      type: 'TEMPO',
      steps: [
        { kind: 'WARMUP', distanceM: warm, zone: 'EASY', label: 'Warm up' },
        { kind: 'RUN', distanceM: unit * 2, zone: 'THRESHOLD', label: 'Tempo' },
        { kind: 'RECOVERY', distanceM: unit, zone: 'EASY', label: 'Recover' },
        { kind: 'RUN', distanceM: unit, zone: 'THRESHOLD', label: 'Tempo' },
        { kind: 'COOLDOWN', distanceM: cool, zone: 'EASY', label: 'Cool down' },
      ],
    }
  },
}

const thresholdRepeats: Template = {
  id: 'threshold_2km_repeats',
  type: 'THRESHOLD',
  minM: 6000,
  build: ({ targetM }) => {
    const reps = Math.max(2, Math.min(4, Math.floor((targetM - 3000) / 2400)))
    const work = reps * 2000 + (reps - 1) * 400
    const warm = m(Math.max(1000, (targetM - work) * 0.6))
    return {
      templateId: 'threshold_2km_repeats',
      name: `Tempo ${reps}km Repeats`,
      type: 'THRESHOLD',
      steps: [
        { kind: 'WARMUP', distanceM: warm, zone: 'EASY', label: 'Warm up' },
        { kind: 'REPEAT', count: reps, children: [
          { kind: 'RUN', distanceM: 2000, zone: 'THRESHOLD', label: 'Threshold' },
          { kind: 'RECOVERY', distanceM: 400, zone: 'RECOVERY', label: 'Jog' },
        ] },
        { kind: 'COOLDOWN', distanceM: Math.max(500, targetM - warm - work), zone: 'EASY', label: 'Cool down' },
      ],
    }
  },
}

const progressiveRun: Template = {
  id: 'progressive_run',
  type: 'THRESHOLD',
  minM: 6000,
  build: ({ targetM }) => {
    const third = m(targetM / 3)
    return {
      templateId: 'progressive_run',
      name: `${fmt(targetM)} Progressive Run`,
      type: 'THRESHOLD',
      steps: [
        { kind: 'RUN', distanceM: third, zone: 'EASY', label: 'Easy' },
        { kind: 'RUN', distanceM: third, zone: 'MARATHON', label: 'Steady' },
        { kind: 'RUN', distanceM: targetM - third * 2, zone: 'THRESHOLD', label: 'Strong' },
      ],
    }
  },
}

/** The `Pyramid Intervals` from the reference screenshots. */
const pyramidIntervals: Template = {
  id: 'pyramid_intervals',
  type: 'INTERVALS',
  minM: 6000,
  build: ({ targetM }) => {
    const ladder = [400, 800, 1200, 800, 400]
    const work = ladder.reduce((a, b) => a + b, 0) + 400 * 4
    const warm = m(Math.max(1200, (targetM - work) / 2))
    const children: WorkoutStep[] = []
    ladder.forEach((d, i) => {
      children.push({ kind: 'RUN', distanceM: d, zone: 'INTERVAL', label: `${d}m` })
      if (i < ladder.length - 1) {
        children.push({ kind: 'RECOVERY', distanceM: 400, zone: 'RECOVERY', label: 'Jog' })
      }
    })
    return {
      templateId: 'pyramid_intervals',
      name: 'Pyramid Intervals',
      type: 'INTERVALS',
      steps: [
        { kind: 'WARMUP', distanceM: warm, zone: 'EASY', label: 'Warm up' },
        ...children,
        { kind: 'COOLDOWN', distanceM: Math.max(800, targetM - warm - work), zone: 'EASY', label: 'Cool down' },
      ],
    }
  },
}

/** The `Progressive Mile Repeats` from the reference screenshots. */
const mileRepeats: Template = {
  id: 'progressive_mile_repeats',
  type: 'INTERVALS',
  minM: 8000,
  build: ({ targetM }) => {
    const reps = Math.max(3, Math.min(5, Math.floor((targetM - 4000) / 2000)))
    const work = reps * 1609 + (reps - 1) * 400
    const warm = m(Math.max(1500, (targetM - work) / 2))
    return {
      templateId: 'progressive_mile_repeats',
      name: 'Progressive Mile Repeats',
      type: 'INTERVALS',
      steps: [
        { kind: 'WARMUP', distanceM: warm, zone: 'EASY', label: 'Warm up' },
        { kind: 'REPEAT', count: reps, children: [
          { kind: 'RUN', distanceM: 1609, zone: 'TEN_K', label: '1 mile, each a little faster' },
          { kind: 'RECOVERY', distanceM: 400, zone: 'RECOVERY', label: 'Jog' },
        ] },
        { kind: 'COOLDOWN', distanceM: Math.max(800, targetM - warm - work), zone: 'EASY', label: 'Cool down' },
      ],
    }
  },
}

const raceDay: Template = {
  id: 'race_day',
  type: 'RACE',
  minM: 1000,
  build: ({ targetM }) => ({
    templateId: 'race_day',
    name: 'Race Day',
    type: 'RACE',
    steps: [
      { kind: 'WARMUP', distanceM: 1500, zone: 'EASY', label: 'Warm up' },
      { kind: 'RUN', distanceM: targetM, zone: 'FIVE_K', label: 'Race' },
    ],
  }),
}

export const TEMPLATES = {
  easy_run: easyRun,
  recovery_run: recoveryRun,
  long_run: longRun,
  race_pace_long: racePaceLong,
  strides,
  fartlek,
  short_tempo: shortTempo,
  tempo_2_1_1: tempo211,
  threshold_2km_repeats: thresholdRepeats,
  progressive_run: progressiveRun,
  pyramid_intervals: pyramidIntervals,
  progressive_mile_repeats: mileRepeats,
  race_day: raceDay,
} satisfies Record<string, Template>

export type TemplateId = keyof typeof TEMPLATES

/** Quality rotation per phase. Index by the week's quality slot. */
export const QUALITY_POOL: Record<string, TemplateId[]> = {
  BASE: ['strides', 'fartlek', 'short_tempo'],
  BUILD: ['tempo_2_1_1', 'threshold_2km_repeats', 'progressive_run'],
  PEAK: ['pyramid_intervals', 'progressive_mile_repeats', 'race_pace_long'],
  TAPER: ['short_tempo', 'tempo_2_1_1'],
  RACE: ['easy_run'],
}

function fmt(metres: number): string {
  const km = metres / 1000
  return `${km % 1 === 0 ? km : km.toFixed(1)}km`
}
