import { requireUserId } from '@/lib/auth'
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
