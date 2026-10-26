import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { requireUserId } from '@/lib/auth'
import { db } from '@/lib/db'
import { activities, workoutActivityLinks } from '@/lib/db/schema'
import { AppError, route } from '@/lib/errors'
import { linkActivity } from '@/lib/services/link-service'

export const runtime = 'nodejs'

const manualSchema = z.object({
  name: z.string().trim().min(1, 'Give the run a name.').max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'),
  distanceKm: z.number().positive('How far did you go?').max(500),
  durationMin: z.number().positive('How long did it take?').max(1440),
  /** Optional: attach it to a session in the same request. */
  workoutId: z.string().uuid().optional(),
})

/**
 * Log a run by hand.
 *
 * This is the path that keeps the app fully usable with no integration
 * connected — and it is what the Link tab offers instead of a Strava button
 * that cannot yet do anything.
 */
export const POST = route(async (req: Request) => {
  const userId = await requireUserId()

  const parsed = manualSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new AppError(
      'VALIDATION_FAILED',
      first?.message ?? 'Check the run details.',
      undefined,
      String(first?.path[0] ?? ''),
    )
  }

  const { name, date, distanceKm, durationMin, workoutId } = parsed.data

  const today = new Date().toISOString().slice(0, 10)
  if (date > today) throw new AppError('VALIDATION_FAILED', 'That date is in the future.', undefined, 'date')

  const distanceM = Math.round(distanceKm * 1000)
  const movingTimeS = Math.round(durationMin * 60)
  // 07:00 local is a reasonable stand-in; a hand-logged run has no clock time,
  // and the matcher only cares about the date.
  const startedAt = new Date(`${date}T07:00:00Z`)

  const [created] = await db
    .insert(activities)
    .values({
      userId,
      source: 'MANUAL',
      name,
      sportType: 'Run',
      startedAt,
      startedAtLocal: startedAt,
      distanceM,
      movingTimeS,
      elapsedTimeS: movingTimeS,
      avgPaceSPerKm: Math.round(movingTimeS / distanceKm),
    })
    .returning({ id: activities.id })

  if (!created) throw new AppError('INTERNAL', 'Could not save that run.')

  if (workoutId) await linkActivity(userId, workoutId, created.id)

  return Response.json({ id: created.id, linked: Boolean(workoutId) }, { status: 201 })
})

export const GET = route(async (req: Request) => {
  const userId = await requireUserId()
  const unlinkedOnly = new URL(req.url).searchParams.get('unlinked') === 'true'

  const rows = await db
    .select({ activity: activities })
    .from(activities)
    .leftJoin(workoutActivityLinks, eq(workoutActivityLinks.activityId, activities.id))
    .where(
      unlinkedOnly
        ? and(eq(activities.userId, userId), isNull(workoutActivityLinks.activityId))
        : eq(activities.userId, userId),
    )
    .orderBy(desc(activities.startedAtLocal))
    .limit(50)

  return Response.json({ activities: rows.map((r) => r.activity) })
})
