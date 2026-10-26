import { requireUserId } from '@/lib/auth'
import { AppError, route } from '@/lib/errors'
import { generatePlan, type PlanRequest } from '@/lib/plan-engine'
import { checkRateLimit } from '@/lib/rate-limit'
import { planRequestSchema } from '@/lib/validation/plan'

export const runtime = 'nodejs'

/**
 * Runs the engine WITHOUT persisting anything.
 *
 * This is what makes the wizard feel alive: drag the weekly mileage slider
 * and twelve weeks of training reshape under it. Blocking issues come back as
 * 200 with `summary: null`, because the wizard needs to render them — they are
 * a state of the form, not an HTTP failure.
 */
export const POST = route(async (req: Request) => {
  // The middleware matcher deliberately skips /api, so this route has to do
  // its own gate. It runs the whole engine, so it is metered as well.
  const userId = await requireUserId()
  await checkRateLimit(`preview:${userId}`, 120, 60)

  const parsed = planRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new AppError('VALIDATION_FAILED', first?.message ?? 'Check your answers.', undefined, String(first?.path[0] ?? ''))
  }

  const plan = generatePlan(parsed.data as PlanRequest)
  const blocked = plan.issues.some((i) => i.severity === 'error')

  return Response.json({
    issues: plan.issues,
    paceZones: plan.paceZones,
    summary: blocked
      ? null
      : {
          totalWeeks: plan.totalWeeks,
          totalDistanceM: plan.totalDistanceM,
          peakWeeklyM: plan.peakWeeklyM,
          longestRunM: plan.longestRunM,
          workoutCount: plan.workouts.length,
          weeks: plan.weeks.map((w) => ({
            weekNo: w.weekNo,
            phase: w.phase,
            targetDistanceM: w.targetDistanceM,
            isCutback: w.isCutback,
            isTaper: w.isTaper,
            sessions: plan.workouts
              .filter((x) => x.weekNo === w.weekNo)
              .map((x) => ({ name: x.name, type: x.type, distanceM: x.plannedDistanceM, weekday: x.weekday })),
          })),
        },
  })
})
