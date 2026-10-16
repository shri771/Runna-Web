/**
 * The pipeline.
 *
 *   PlanRequest
 *     -> validate            issues (errors block, warnings inform)
 *     -> derivePaceZones     eight zones from one equivalent 5K time
 *     -> buildPhases         base / build / peak / taper
 *     -> buildMileageCurve   weekly volume, capped at the user's target
 *     -> buildLongRunCurve   long run progression
 *     -> assignSessionSlots  which day gets which kind of session
 *     -> materialise         templates -> workouts with steps and paces
 *     -> balanceToTarget     spread the remainder across the easy runs
 *     -> Plan
 *
 * Deterministic: same request in, byte-identical plan out. No clock reads.
 */

import { addDays, addWeeks, startOfWeek, weekdayOf } from './dates'
import { buildLongRunCurve } from './longrun'
import { buildMileageCurve } from './mileage'
import { derivePaceZones, estimateDuration } from './paces'
import { buildPhases } from './phases'
import { assignSessionSlots, type SessionSlot } from './schedule'
import { QUALITY_POOL, TEMPLATES, stepsDistanceM, type TemplateId } from './templates'
import { hasBlockingIssue, totalWeeksFor, validate } from './validate'
import {
  GOAL_DISTANCE_M,
  WEEKDAY_NAMES,
  type ISODate,
  type PaceZone,
  type PaceZones,
  type Plan,
  type PlanRequest,
  type PlanWeek,
  type Workout,
  type WorkoutStep,
  type Weekday,
} from './types'

const MIN_EASY_M = 3000
/** A single quality session should never dominate the week. */
const QUALITY_MAX_SHARE = 0.4
/**
 * ...but a real session has a practical floor. Without this, a low-volume week
 * can only afford one template and the plan repeats the same session weekly.
 */
const MIN_QUALITY_M = 5000

export function generatePlan(req: PlanRequest): Plan {
  const issues = validate(req)
  const zones = derivePaceZones(req.paceBasis, req.ability)

  const empty: Plan = {
    goal: req.goal,
    startDate: req.startDate,
    raceDate: req.raceDate,
    raceName: req.raceName,
    totalWeeks: 0,
    totalDistanceM: 0,
    peakWeeklyM: 0,
    longestRunM: 0,
    paceZones: zones,
    weeks: [],
    workouts: [],
    issues,
  }

  if (hasBlockingIssue(issues)) return empty

  const totalWeeks = totalWeeksFor(req)
  if (totalWeeks <= 0) return empty

  const raceKm = GOAL_DISTANCE_M[req.goal] / 1000
  const extendBase = raceKm > 0 && req.currentLongestKm < raceKm * 0.3

  const phases = buildPhases(totalWeeks, req.goal, extendBase)
  const mileage = buildMileageCurve({
    phases,
    currentWeeklyKm: req.currentWeeklyKm,
    targetWeeklyKm: req.targetWeeklyKm,
    progression: req.progression,
    ability: req.ability,
    goal: req.goal,
  })
  const longRunM = buildLongRunCurve({
    phases,
    weeklyM: mileage.weeklyM,
    cutbackWeeks: mileage.cutbackWeeks,
    currentLongestKm: req.currentLongestKm,
    maxLongKm: req.maxLongKm,
    daysPerWeek: req.daysPerWeek,
    goal: req.goal,
  })

  const planStart = startOfWeek(req.startDate)
  const weeks: PlanWeek[] = []
  const workouts: Workout[] = []

  for (let i = 0; i < totalWeeks; i++) {
    const phase = phases.byWeek[i] ?? 'BASE'
    const weekStart = addWeeks(planStart, i)
    const targetM = mileage.weeklyM[i] ?? 0

    weeks.push({
      weekNo: i + 1,
      startDate: weekStart,
      endDate: addDays(weekStart, 6),
      phase,
      targetDistanceM: targetM,
      isCutback: mileage.cutbackWeeks[i] ?? false,
      isTaper: phase === 'TAPER',
    })

    const slots = assignSessionSlots(req.daysPerWeek, req.preferredDays, req.longRunDay, phase)
    workouts.push(
      ...materialiseWeek({
        req,
        zones,
        weekNo: i + 1,
        weekStart,
        phase,
        targetM,
        longRunM: longRunM[i] ?? 0,
        slots,
        isRaceWeek: phase === 'RACE',
      }),
    )
  }

  const totalDistanceM = workouts.reduce((sum, w) => sum + w.plannedDistanceM, 0)
  const longestRunM = workouts.reduce((max, w) => Math.max(max, w.plannedDistanceM), 0)

  return {
    goal: req.goal,
    startDate: planStart,
    raceDate: req.raceDate,
    raceName: req.raceName,
    totalWeeks,
    totalDistanceM,
    peakWeeklyM: Math.max(0, ...mileage.weeklyM),
    longestRunM,
    paceZones: zones,
    weeks,
    workouts,
    issues,
  }
}

type WeekContext = {
  req: PlanRequest
  zones: PaceZones
  weekNo: number
  weekStart: ISODate
  phase: string
  targetM: number
  longRunM: number
  slots: SessionSlot[]
  isRaceWeek: boolean
}

function materialiseWeek(ctx: WeekContext): Workout[] {
  const { req, zones, weekNo, weekStart, phase, targetM, longRunM, slots, isRaceWeek } = ctx

  // Race week: the race itself on the race day, shakeouts before it.
  if (isRaceWeek && req.raceDate) {
    const raceDistanceM = GOAL_DISTANCE_M[req.goal]
    const raceWeekday = weekdayOf(req.raceDate)
    const out: Workout[] = []

    // Shakeouts only fill whatever the week's target leaves over the race
    // itself, so race week doesn't balloon past its planned volume.
    const SHAKEOUT_M = 3000
    let budget = Math.max(0, targetM - raceDistanceM - 1500)
    for (const slot of slots) {
      if (slot.weekday >= raceWeekday) continue
      if (budget < SHAKEOUT_M) break
      budget -= SHAKEOUT_M
      out.push(
        buildWorkout({
          templateId: 'recovery_run',
          targetM: SHAKEOUT_M,
          zones,
          weekNo,
          weekStart,
          weekday: slot.weekday,
          orderInDay: 0,
        }),
      )
    }

    out.push(
      buildWorkout({
        templateId: 'race_day',
        targetM: raceDistanceM,
        zones,
        weekNo,
        weekStart,
        weekday: raceWeekday,
        orderInDay: 0,
      }),
    )
    return out
  }

  // 1. Long run and quality sessions take their share first.
  const phasePool = QUALITY_POOL[phase] ?? QUALITY_POOL.BASE!
  const hardCap = req.maxHardKm ? req.maxHardKm * 1000 : Infinity
  const share = Math.min(hardCap, targetM * 0.22)

  // Only consider templates the week can actually hold. Without this a 16km
  // beginner week gets handed an 8.4km mile-repeat session, because the
  // template's own minimum overrides the week's budget.
  const budget = Math.min(hardCap, Math.max(targetM * QUALITY_MAX_SHARE, MIN_QUALITY_M))
  const affordable = phasePool.filter((id) => TEMPLATES[id].minM <= budget)
  const pool = affordable.length > 0
    ? affordable
    : [[...phasePool].sort((a, b) => TEMPLATES[a].minM - TEMPLATES[b].minM)[0]!]

  const planned: { slot: SessionSlot; templateId: TemplateId; targetM: number }[] = []
  let committed = 0

  for (const slot of slots) {
    if (slot.kind === 'LONG') {
      planned.push({ slot, templateId: 'long_run', targetM: longRunM })
      committed += longRunM
    } else if (slot.kind === 'QUALITY') {
      // Rotate templates by week so consecutive weeks aren't identical.
      const index = (weekNo - 1 + (slot.qualityIndex ?? 0)) % pool.length
      const templateId = pool[index]!
      const qualityM = Math.max(TEMPLATES[templateId].minM, roundTo(share, 500))
      planned.push({ slot, templateId, targetM: qualityM })
      committed += qualityM
    }
  }

  // 2. Spread what's left across the easy and recovery runs.
  const fillers = slots.filter((s) => s.kind === 'EASY' || s.kind === 'RECOVERY')
  const remaining = Math.max(0, targetM - committed)
  const maxEasyM = req.maxEasyKm ? req.maxEasyKm * 1000 : Infinity

  if (fillers.length === 0 && remaining > 0) {
    // Nothing to spread the remainder across (a 2-day week is long + quality
    // only), so it goes onto the long run, within its cap.
    const long = planned.find((p) => p.templateId === 'long_run')
    if (long) {
      const cap = req.maxLongKm ? req.maxLongKm * 1000 : Infinity
      long.targetM = roundTo(Math.min(cap, long.targetM + remaining), 500)
    }
  }

  if (fillers.length > 0) {
    const even = roundTo(remaining / fillers.length, 500)
    let allocated = 0
    fillers.forEach((slot, i) => {
      const isLast = i === fillers.length - 1
      // Absorb the rounding residue into the final easy run.
      const raw = isLast ? remaining - allocated : even
      const distance = Math.min(maxEasyM, Math.max(MIN_EASY_M, roundTo(raw, 500)))
      allocated += distance
      planned.push({
        slot,
        templateId: slot.kind === 'RECOVERY' ? 'recovery_run' : 'easy_run',
        targetM: distance,
      })
    })
  }

  return planned
    .sort((a, b) => a.slot.weekday - b.slot.weekday)
    .map(({ slot, templateId, targetM: distance }) =>
      buildWorkout({
        templateId,
        targetM: distance,
        zones,
        weekNo,
        weekStart,
        weekday: slot.weekday,
        orderInDay: 0,
      }),
    )
}

function buildWorkout(args: {
  templateId: TemplateId
  targetM: number
  zones: PaceZones
  weekNo: number
  weekStart: ISODate
  weekday: Weekday
  orderInDay: number
}): Workout {
  const { templateId, targetM, zones, weekNo, weekStart, weekday, orderInDay } = args
  const template = TEMPLATES[templateId]
  const result = template.build({ targetM: Math.max(template.minM, targetM), zones, weekNo })

  // Templates round their internal segments, so the true distance is the sum
  // of the steps — not the requested target.
  const plannedDistanceM = stepsDistanceM(result.steps)
  const [minS, maxS] = estimateStepsDuration(result.steps, zones)

  return {
    workoutKey: `w${weekNo}-${WEEKDAY_NAMES[weekday].toLowerCase()}-${result.templateId}`,
    date: addDays(weekStart, weekday),
    weekNo,
    weekday,
    orderInDay,
    type: result.type,
    templateId: result.templateId,
    name: result.name,
    plannedDistanceM,
    estDurationMinS: minS,
    estDurationMaxS: maxS,
    steps: result.steps,
    isExtra: false,
  }
}

/** Sum each step's time at its zone's pace range. Rounded to 5 minutes. */
function estimateStepsDuration(steps: WorkoutStep[], zones: PaceZones): [number, number] {
  let min = 0
  let max = 0
  const walk = (list: WorkoutStep[], multiplier: number) => {
    for (const step of list) {
      if (step.kind === 'REPEAT') {
        walk(step.children, multiplier * step.count)
        continue
      }
      if (step.durationS) {
        min += step.durationS * multiplier
        max += step.durationS * multiplier
        continue
      }
      const [fast, slow] = estimateDuration(step.distanceM ?? 0, zones[step.zone as PaceZone])
      min += fast * multiplier
      max += slow * multiplier
    }
  }
  walk(steps, 1)
  const to5min = (s: number) => Math.round(s / 300) * 300
  return [to5min(min), Math.max(to5min(max), to5min(min) + 300)]
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step
