import bcrypt from 'bcryptjs'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { authConfig } from './auth.config'
import { db } from './db'
import { accounts, athleteProfiles, sessions, users, verificationTokens } from './db/schema'
import { AppError } from './errors'
import { credentialsSchema } from './validation/plan'

const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    // Only registered when credentials exist, so a deployment without Google
    // set up does not fail at boot — it just shows one fewer sign-in option.
    ...(googleConfigured
      ? [
          Google({
            // Google verifies the email addresses it hands out, so letting a
            // Google sign-in attach to an existing account with the same
            // address is safe here. Without it, anyone who signed up with a
            // password and then clicks "Continue with Google" hits an opaque
            // OAuthAccountNotLinked error.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
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
        const ok = await bcrypt.compare(parsed.data.password, hash)
        if (!user || !ok) return null

        return { id: user.id, email: user.email, name: user.name, image: user.image }
      },
    }),
  ],
  events: {
    /**
     * A Google sign-in creates the user row through the adapter, which knows
     * nothing about training. Without a profile the plan builder has no
     * ability or pace basis to start from, so one is created on first sign-in.
     */
    async createUser({ user }) {
      if (!user.id) return
      await db.insert(athleteProfiles).values({ userId: user.id }).onConflictDoNothing()
    },
  },
})

/** Whether to offer the Google button at all. */
export const isGoogleEnabled = () => googleConfigured

/** Every data access goes through this. Missing session is a hard stop. */
export async function requireUserId(): Promise<string> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) throw new AppError('UNAUTHENTICATED', 'Sign in to continue.')
  return id
}
