import { route } from '@/lib/errors'

export const runtime = 'nodejs'

/**
 * Where Strava returns the user after the consent screen.
 *
 * The token exchange is deliberately not implemented yet, so nothing is
 * stored. This route exists only so the round trip does not dead-end on a
 * 404 — it hands the user back to the Link tab with an explanation of what
 * did and did not happen.
 */
export const GET = route(async (req: Request) => {
  const params = new URL(req.url).searchParams
  const outcome = params.get('error') ? 'cancelled' : params.get('code') ? 'incomplete' : 'unknown'

  return Response.redirect(new URL(`/link?strava=${outcome}`, req.url), 302)
})
