import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { athleteProfiles, planSettings, planVersions, planWeeks, plans, workouts } from '@/lib/db/schema'
import { AppError } from '@/lib/errors'
import { equivalent5kTime, generatePlan, type Plan, type PlanRequest } from '@/lib/plan-engine'

/**
 * Persistence for generated plans.
 *
 * The engine stays pure; this is the only place its output meets the
 * database. A plan is written as Plan + PlanSettings + PlanVersion(1) +
 * weeks + workouts, and the version carries the exact request that produced
 * it so any plan is reproducible from its row alone.
 */

export async function createPlan(userId: string, request: PlanRequest, opts?: { archiveFirst?: boolean }) {
  const plan = generatePlan(request)

  if (plan.issues.some((i) => i.severity === 'error')) {
    throw new AppError('PLAN_GENERATION_FAILED', 'That plan cannot be built as specified.', {
      issues: plan.issues.filter((i) => i.severity === 'error'),
    })
  }
  if (plan.weeks.length === 0) {
    throw new AppError('PLAN_GENERATION_FAILED', 'That plan came out empty. Check your race date.')
  }

  const [active] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.userId, userId), eq(plans.status, 'ACTIVE')))
    .limit(1)

  if (active) {
    if (!opts?.archiveFirst) {
      throw new AppError('PLAN_ALREADY_ACTIVE', 'You already have an active plan.', { planId: active.id })
    }
    await db.update(plans).set({ status: 'ARCHIVED' }).where(eq(plans.id, active.id))
  }

  const planId = await writePlan(userId, request, plan)

  // Keep the profile in step with what the user just told the wizard, so the
  // next plan starts from their latest answers rather than stale onboarding.
  await db
    .insert(athleteProfiles)
    .values({
      userId,
      ability: request.ability,
      paceBasisKind: request.paceBasis?.kind,
      paceBasisDistanceM: request.paceBasis?.kind === 'RACE_RESULT' ? request.paceBasis.distanceM : null,
      paceBasisTimeS:
        request.paceBasis?.kind === 'RACE_RESULT' || request.paceBasis?.kind === 'ESTIMATED_5K'
          ? request.paceBasis.timeS
          : null,
      estimated5kS: Math.round(equivalent5kTime(request.paceBasis, request.ability)),
      weeklyKm: String(request.currentWeeklyKm),
      longestRunKm: String(request.currentLongestKm),
    })
    .onConflictDoUpdate({
      target: athleteProfiles.userId,
      set: {
        ability: request.ability,
        weeklyKm: String(request.currentWeeklyKm),
        longestRunKm: String(request.currentLongestKm),
        estimated5kS: Math.round(equivalent5kTime(request.paceBasis, request.ability)),
        updatedAt: new Date(),
      },
    })

  return { planId, summary: summarise(plan) }
}

async function writePlan(userId: string, request: PlanRequest, plan: Plan): Promise<string> {
  const [row] = await db
    .insert(plans)
    .values({
      userId,
      goal: plan.goal,
      raceName: plan.raceName ?? null,
      raceDate: plan.raceDate ?? null,
      startDate: plan.startDate,
      totalWeeks: plan.totalWeeks,
      status: 'ACTIVE',
    })
    .returning({ id: plans.id })

  if (!row) throw new AppError('INTERNAL', 'Could not create the plan.')
  const planId = row.id

  await db.insert(planSettings).values({
    planId,
    daysPerWeek: request.daysPerWeek,
    preferredDays: request.preferredDays,
    longRunDay: request.longRunDay,
    progression: request.progression,
    targetWeeklyKm: request.targetWeeklyKm != null ? String(request.targetWeeklyKm) : null,
    maxEasyKm: request.maxEasyKm != null ? String(request.maxEasyKm) : null,
    maxLongKm: request.maxLongKm != null ? String(request.maxLongKm) : null,
    maxHardKm: request.maxHardKm != null ? String(request.maxHardKm) : null,
  })

  const [version] = await db
    .insert(planVersions)
    .values({
      planId,
      versionNo: 1,
      reason: 'INITIAL',
      inputsSnapshot: request,
      totalDistanceM: plan.totalDistanceM,
      peakWeeklyM: plan.peakWeeklyM,
    })
    .returning({ id: planVersions.id })

  if (!version) throw new AppError('INTERNAL', 'Could not create the plan version.')

  const weekRows = await db
    .insert(planWeeks)
    .values(
      plan.weeks.map((w) => ({
        planVersionId: version.id,
        weekNo: w.weekNo,
        startDate: w.startDate,
        endDate: w.endDate,
        phase: w.phase,
        targetDistanceM: w.targetDistanceM,
        isCutback: w.isCutback,
        isTaper: w.isTaper,
      })),
    )
    .returning({ id: planWeeks.id, weekNo: planWeeks.weekNo })

  const weekIdByNo = new Map(weekRows.map((w) => [w.weekNo, w.id]))

  if (plan.workouts.length > 0) {
    await db.insert(workouts).values(
      plan.workouts.map((w) => {
        const planWeekId = weekIdByNo.get(w.weekNo)
        if (!planWeekId) throw new AppError('INTERNAL', `No week row for workout in week ${w.weekNo}.`)
        return {
          planWeekId,
          workoutKey: w.workoutKey,
          date: w.date,
          orderInDay: w.orderInDay,
          type: w.type,
          templateId: w.templateId,
          name: w.name,
          plannedDistanceM: w.plannedDistanceM,
          estDurationMinS: w.estDurationMinS,
          estDurationMaxS: w.estDurationMaxS,
          steps: w.steps,
          isExtra: w.isExtra,
        }
      }),
    )
  }

  await db.update(plans).set({ currentVersionId: version.id }).where(eq(plans.id, planId))
  return planId
}

const summarise = (plan: Plan) => ({
  totalWeeks: plan.totalWeeks,
  totalDistanceM: plan.totalDistanceM,
  peakWeeklyM: plan.peakWeeklyM,
  workoutCount: plan.workouts.length,
})

/** The active plan plus its settings and current version. Null when none. */
export async function getActivePlan(userId: string) {
  const [row] = await db
    .select({ plan: plans, settings: planSettings, version: planVersions })
    .from(plans)
    .leftJoin(planSettings, eq(planSettings.planId, plans.id))
    .leftJoin(planVersions, eq(planVersions.id, plans.currentVersionId))
    .where(and(eq(plans.userId, userId), eq(plans.status, 'ACTIVE')))
    .limit(1)

  return row ?? null
}

/** Weeks with their workouts, for a date range. Powers Today and Calendar. */
export async function getWeeks(versionId: string, from?: string, to?: string) {
  const weeks = await db
    .select()
    .from(planWeeks)
    .where(
      from && to
        ? and(eq(planWeeks.planVersionId, versionId), gte(planWeeks.endDate, from), lte(planWeeks.startDate, to))
        : eq(planWeeks.planVersionId, versionId),
    )
    .orderBy(asc(planWeeks.weekNo))

  if (weeks.length === 0) return []

  // One query per week would be N+1; fetch every workout in the range at once,
  // scoped to these week ids so nothing outside the plan can come back.
  const rows = await db
    .select()
    .from(workouts)
    .where(inArray(workouts.planWeekId, weeks.map((w) => w.id)))
    .orderBy(asc(workouts.date), asc(workouts.orderInDay))

  return weeks.map((week) => ({
    ...week,
    workouts: rows.filter((w) => w.planWeekId === week.id),
  }))
}
