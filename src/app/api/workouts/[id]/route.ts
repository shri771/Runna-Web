import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireUserId } from '@/lib/auth'
import { db } from '@/lib/db'
import { planVersions, planWeeks, plans, workouts } from '@/lib/db/schema'
import { AppError, route } from '@/lib/errors'

export const runtime = 'nodejs'

const patchSchema = z.object({
  status: z.enum(['SCHEDULED', 'COMPLETED', 'SKIPPED']).optional(),
  notes: z.string().max(2000).nullable().optional(),
  rpe: z.number().int().min(1).max(5).nullable().optional(),
})

/**
 * Ownership is verified by joining the workout all the way back to the user.
 * A workout someone else owns returns 404, not 403 — we do not confirm that
 * it exists.
 */
async function requireOwnedWorkout(userId: string, workoutId: string) {
  const [row] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .innerJoin(planWeeks, eq(planWeeks.id, workouts.planWeekId))
    .innerJoin(planVersions, eq(planVersions.id, planWeeks.planVersionId))
    .innerJoin(plans, eq(plans.id, planVersions.planId))
    .where(and(eq(workouts.id, workoutId), eq(plans.userId, userId)))
    .limit(1)

  if (!row) throw new AppError('NOT_FOUND', 'That workout does not exist.')
  return row.id
}

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId()
  const { id } = await ctx.params
  await requireOwnedWorkout(userId, id)

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) throw new AppError('VALIDATION_FAILED', 'Nothing valid to update.')

  const [updated] = await db
    .update(workouts)
    .set(parsed.data)
    .where(eq(workouts.id, id))
    .returning({ id: workouts.id, status: workouts.status })

  return Response.json(updated)
})

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId()
  const { id } = await ctx.params
  await requireOwnedWorkout(userId, id)

  const [workout] = await db.select().from(workouts).where(eq(workouts.id, id)).limit(1)
  if (!workout) throw new AppError('NOT_FOUND', 'That workout does not exist.')
  return Response.json(workout)
})
