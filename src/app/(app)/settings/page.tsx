import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { AppHeader } from '@/components/nav/app-header'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { athleteProfiles, stravaConnections } from '@/lib/db/schema'
import { derivePaceZones, formatPaceRange, type Ability, type PaceBasis } from '@/lib/plan-engine'

export const dynamic = 'force-dynamic'

const ABILITY_LABEL: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
}

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/sign-in?next=/settings')

  const [profile] = await db
    .select()
    .from(athleteProfiles)
    .where(eq(athleteProfiles.userId, session.user.id))
    .limit(1)

  const [strava] = await db
    .select()
    .from(stravaConnections)
    .where(eq(stravaConnections.userId, session.user.id))
    .limit(1)

  const basis: PaceBasis | undefined =
    profile?.paceBasisKind === 'RACE_RESULT' && profile.paceBasisDistanceM && profile.paceBasisTimeS
      ? { kind: 'RACE_RESULT', distanceM: profile.paceBasisDistanceM, timeS: profile.paceBasisTimeS }
      : profile?.paceBasisKind === 'ESTIMATED_5K' && profile.paceBasisTimeS
        ? { kind: 'ESTIMATED_5K', timeS: profile.paceBasisTimeS }
        : undefined

  const zones = derivePaceZones(basis, (profile?.ability ?? 'INTERMEDIATE') as Ability)

  return (
    <>
      <AppHeader
        title="Settings"
        user={{ name: session.user.name ?? null, image: session.user.image ?? null }}
      />

      <section className="rounded-[14px] border border-hairline bg-slate p-5">
        <p className="text-[17px] font-semibold">{session.user.name ?? 'Runner'}</p>
        <p className="mt-0.5 text-[14px] text-ash">{session.user.email}</p>
      </section>

      <section className="mt-4 rounded-[14px] border border-hairline bg-slate p-5">
        <h2 className="text-[15px] font-semibold">Your training paces</h2>
        <p className="mt-0.5 text-[13px] text-ash">
          {basis
            ? `Worked out from your ${ABILITY_LABEL[profile?.ability ?? ''] ?? ''} level and a recent result.`
            : 'Estimated from your ability level. Add a recent race result to sharpen these.'}
        </p>

        <dl className="mt-4 divide-y divide-hairline border-t border-hairline">
          {(['RECOVERY', 'EASY', 'LONG', 'MARATHON', 'THRESHOLD', 'TEN_K', 'FIVE_K', 'INTERVAL'] as const).map(
            (zone) => (
              <div key={zone} className="flex items-baseline justify-between py-2.5">
                <dt className="text-[14px] text-ash capitalize">{zone.replace('_', ' ').toLowerCase()}</dt>
                <dd className="fig text-[15px] font-semibold">{formatPaceRange(zones[zone])}</dd>
              </div>
            ),
          )}
        </dl>
      </section>

      <section className="mt-4 rounded-[14px] border border-hairline bg-slate p-5">
        <h2 className="text-[15px] font-semibold">Strava</h2>
        {strava ? (
          <>
            <p className="mt-1 text-[14px] text-ash">
              Connected{strava.athleteName ? ` as ${strava.athleteName}` : ''}.
              {strava.lastSyncAt
                ? ` Last synced ${strava.lastSyncAt.toLocaleString('en-GB')}.`
                : ' Not synced yet.'}
            </p>
            {strava.status === 'REVOKED' && (
              <p className="mt-3 rounded-[10px] border border-caution/40 bg-caution/10 p-3 text-[13px]">
                Access was revoked on Strava. Reconnect to start importing runs again.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mt-1 text-[14px] text-ash">
              Not connected. You can still log runs by hand and link them to your sessions.
            </p>
            <Link href="/link" className="mt-3 inline-block text-[14px] font-medium underline">
              Go to Link runs
            </Link>
          </>
        )}
      </section>

      <nav className="mt-4 divide-y divide-hairline overflow-hidden rounded-[14px] border border-hairline bg-slate">
        <Link href="/plan" className="flex items-center justify-between px-4 py-3.5 text-[15px]">
          Your plan
          <ChevronRight size={16} className="text-ash" />
        </Link>
        <Link href="/onboarding" className="flex items-center justify-between px-4 py-3.5 text-[15px]">
          Build a new plan
          <ChevronRight size={16} className="text-ash" />
        </Link>
        <SignOutButton />
      </nav>

      <p className="py-6 text-center text-[12px] text-ash-dim">
        Not affiliated with Runna or Strava. Built as an educational project.
      </p>
    </>
  )
}
