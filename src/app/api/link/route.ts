import { z } from 'zod'
import { requireUserId } from '@/lib/auth'
import { AppError, route } from '@/lib/errors'
import { getCandidates, linkActivity, unlinkActivity } from '@/lib/services/link-service'

export const runtime = 'nodejs'

const linkSchema = z.object({
  workoutId: z.string().uuid(),
  activityId: z.string().uuid(),
  move: z.boolean().optional(),
})

export const POST = route(async (req: Request) => {
  const userId = await requireUserId()
  const parsed = linkSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) throw new AppError('VALIDATION_FAILED', 'Pick a run and a session to link.')

  const result = await linkActivity(userId, parsed.data.workoutId, parsed.data.activityId, parsed.data.move)
  return Response.json(result)
})

export const DELETE = route(async (req: Request) => {
  const userId = await requireUserId()
  const workoutId = new URL(req.url).searchParams.get('workoutId')
  if (!workoutId) throw new AppError('VALIDATION_FAILED', 'Which session should be unlinked?')

  await unlinkActivity(userId, workoutId)
  return Response.json({ ok: true })
})

export const GET = route(async (req: Request) => {
  const userId = await requireUserId()
  const activityId = new URL(req.url).searchParams.get('activityId')
  if (!activityId) throw new AppError('VALIDATION_FAILED', 'Which run?')

  return Response.json({ candidates: await getCandidates(userId, activityId) })
})
