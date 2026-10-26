import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/auth'
import { db } from '@/lib/db'
import { plans } from '@/lib/db/schema'
import { AppError, route } from '@/lib/errors'
import type { PlanRequest } from '@/lib/plan-engine'
import { checkRateLimit } from '@/lib/rate-limit'
import { createPlan, getActivePlan } from '@/lib/services/plan-service'
import { planRequestSchema } from '@/lib/validation/plan'

export const runtime = 'nodejs'

export const GET = route(async () => {
  const userId = await requireUserId()
  const active = await getActivePlan(userId)
  if (!active?.plan) throw new AppError('NOT_FOUND', 'You do not have an active plan yet.')
  return Response.json(active)
})

export const POST = route(async (req: Request) => {
  const userId = await requireUserId()
  await checkRateLimit(`plans:${userId}`, 10, 60 * 60)

  const body = await req.json().catch(() => null)
  const parsed = planRequestSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new AppError(
      'VALIDATION_FAILED',
      first?.message ?? 'Check your answers.',
      undefined,
      String(first?.path[0] ?? ''),
    )
  }

  const archiveFirst = Boolean((body as Record<string, unknown> | null)?.archiveFirst)
  const { planId, summary } = await createPlan(userId, parsed.data as PlanRequest, { archiveFirst })

  return Response.json({ planId, summary }, { status: 201 })
})

/**
 * Delete the active plan outright.
 *
 * Archiving would keep it out of the way but leave the history half-present;
 * a user who asks to delete expects it gone, and the cascade takes its weeks,
 * workouts and links with it. Activities are kept — those are the user's own
 * record of runs they did, not part of the plan.
 */
export const DELETE = route(async () => {
  const userId = await requireUserId()

  const [active] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.userId, userId), eq(plans.status, 'ACTIVE')))
    .limit(1)

  if (!active) throw new AppError('NOT_FOUND', 'You do not have an active plan.')

  await db.delete(plans).where(eq(plans.id, active.id))
  return Response.json({ ok: true })
})
