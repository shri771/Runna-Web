import { and, eq, sql } from 'drizzle-orm'
import { db } from './db'
import { rateLimits } from './db/schema'
import { AppError } from './errors'

/**
 * Fixed-window counter in Postgres.
 *
 * Redis would be the usual answer, but at this scale one table is enough and
 * it is one fewer service to configure, pay for and explain.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const now = Date.now()
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000)

  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count })

  if ((row?.count ?? 0) > limit) {
    const retryAfter = Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now) / 1000)
    throw new AppError('RATE_LIMITED', `Too many attempts. Try again in ${retryAfter}s.`, { retryAfter })
  }
}

/** Best-effort cleanup; called from the daily cron. */
export async function pruneRateLimits(olderThan: Date): Promise<void> {
  await db.delete(rateLimits).where(and(sql`${rateLimits.windowStart} < ${olderThan}`, eq(sql`1`, sql`1`)))
}
