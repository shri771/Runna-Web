import { compare } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from './auth.config'
import { db } from './db'
import { users } from './db/schema'
import { AppError } from './errors'
import { credentialsSchema } from './validation/plan'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1)

        // Same failure for "no such user" and "wrong password", and the hash
        // comparison still runs, so timing does not reveal which it was.
        const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv'
        const ok = await compare(parsed.data.password, hash)
        if (!user || !ok) return null

        return { id: user.id, email: user.email, name: user.name, image: user.avatarUrl }
      },
    }),
  ],
})

/** Every data access goes through this. Missing session is a hard stop. */
export async function requireUserId(): Promise<string> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) throw new AppError('UNAUTHENTICATED', 'Sign in to continue.')
  return id
}
