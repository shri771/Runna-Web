import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'

const { auth } = NextAuth(authConfig)

const APP_ROUTES = ['/today', '/plan', '/calendar', '/link', '/progress', '/settings', '/workouts', '/activities', '/onboarding']
const AUTH_ROUTES = ['/sign-in', '/sign-up']

export default auth((req) => {
  const { pathname } = req.nextUrl
  const signedIn = !!req.auth?.user

  const needsAuth = APP_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  if (needsAuth && !signedIn) {
    const url = new URL('/sign-in', req.nextUrl)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (signedIn && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/today', req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  // Everything except static assets and the auth/webhook endpoints.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
