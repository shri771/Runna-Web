import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { athleteProfiles, users } from '@/lib/db/schema'
import { AppError, route } from '@/lib/errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { registerSchema } from '@/lib/validation/plan'

export const POST = route(async (req: Request) => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  await checkRateLimit(`register:${ip}`, 5, 60 * 60)

  const parsed = registerSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new AppError('VALIDATION_FAILED', first?.message ?? 'Check your details.', undefined, String(first?.path[0] ?? ''))
  }

  const { email, password, name, timezone } = parsed.data
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)

  // Deliberately the same response as a real signup: confirming which emails
  // have accounts would let anyone enumerate the user list.
  if (existing) return Response.json({ ok: true }, { status: 201 })

  const [created] = await db
    .insert(users)
    .values({ email, name, timezone, passwordHash: await bcrypt.hash(password, 12) })
    .returning({ id: users.id })

  if (created) await db.insert(athleteProfiles).values({ userId: created.id })

  return Response.json({ ok: true }, { status: 201 })
})
