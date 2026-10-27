import { requireUserId } from '@/lib/auth'
import { route } from '@/lib/errors'

export const runtime = 'nodejs'

/**
 * Sends the user to Strava's authorisation screen.
 *
 * The exchange on the way back is NOT implemented — see the callback route.
 * This exists so the connect flow can be shown end to end up to Strava's own
 * consent screen; nothing is stored and no runs are imported.
 */
export const GET = route(async (req: Request) => {
  await requireUserId()

  const clientId = process.env.STRAVA_CLIENT_ID
  const redirectUri =
    process.env.STRAVA_REDIRECT_URI ??
    new URL('/api/integrations/strava/callback', req.url).toString()

  // Without a registered application there is nothing to authorise against,
  // so fall back to Strava's plain login rather than sending them to an
  // OAuth error page.
  if (!clientId) {
    return Response.redirect('https://www.strava.com/login', 302)
  }

  const authorize = new URL('https://www.strava.com/oauth/authorize')
  authorize.searchParams.set('client_id', clientId)
  authorize.searchParams.set('redirect_uri', redirectUri)
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('approval_prompt', 'auto')
  authorize.searchParams.set('scope', 'read,activity:read_all')

  return Response.redirect(authorize.toString(), 302)
})
