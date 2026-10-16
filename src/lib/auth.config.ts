import type { NextAuthConfig } from 'next-auth'

/**
 * Edge-safe half of the auth config.
 *
 * Middleware runs on the edge runtime, where bcrypt and the Postgres driver
 * are unavailable. Everything that needs them lives in `auth.ts`; this file
 * holds only what the middleware needs to decide whether to let a request
 * through.
 */
export const authConfig = {
  pages: { signIn: '/sign-in', newUser: '/onboarding' },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  providers: [], // added in auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id
      return token
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
} satisfies NextAuthConfig
