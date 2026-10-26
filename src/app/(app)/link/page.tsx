import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { AppHeader } from '@/components/nav/app-header'
import { ActivityLine, SuggestionCard, type LinkableActivity } from '@/components/workout/link-row'
import { PickWorkout } from '@/components/workout/pick-workout'
import { auth } from '@/lib/auth'
import { getLinkInbox } from '@/lib/services/link-service'
import { formatDistance } from '@/lib/units'

export const dynamic = 'force-dynamic'

export default async function LinkPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/sign-in?next=/link')

  const today = new Date().toISOString().slice(0, 10)
  const { connection, needsReview, unlinked, waiting } = await getLinkInbox(session.user.id, today)

  const allClear = needsReview.length === 0 && unlinked.length === 0 && waiting.length === 0

  return (
    <>
      <AppHeader
        title="Link runs"
        subtitle={allClear ? 'Everything matched' : `${needsReview.length + unlinked.length + waiting.length} to sort out`}
        user={{ name: session.user.name ?? null, image: session.user.image ?? null }}
      />

      {!connection && (
        <section className="rounded-[14px] border border-hairline bg-slate p-5">
          <h2 className="text-[17px] font-semibold">Connect Strava to bring your runs in</h2>
          <p className="mt-1 text-[14px] text-ash">
            We read your runs so each one can be matched to the session it was meant to be. We never
            post anything.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/settings"
              className="rounded-full bg-chalk px-5 py-2.5 text-[15px] font-semibold text-ink"
            >
              Connect Strava
            </Link>
            <Link
              href="/link#manual"
              className="rounded-full border border-hairline-strong px-5 py-2.5 text-[15px] font-semibold"
            >
              Log a run by hand
            </Link>
          </div>
        </section>
      )}

      {allClear && connection && (
        <section className="rounded-[14px] border border-hairline bg-slate p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full border border-chalk/30 bg-chalk/10">
            <Check size={22} />
          </span>
          <h2 className="mt-4 text-[17px] font-semibold">Everything is linked</h2>
          <p className="mt-1 text-[14px] text-ash">
            Every run you have recorded is matched to a session.
          </p>
        </section>
      )}

      {needsReview.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[15px] font-semibold">
            Worth a check
            <span className="ml-2 fig text-[13px] font-normal text-ash">{needsReview.length}</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-ash">
            These runs look like a planned session, but not closely enough to link on their own.
          </p>
          <div className="mt-3 space-y-3">
            {needsReview.map(({ activity, suggestion }) => (
              <SuggestionCard
                key={activity.id}
                activity={serialise(activity)}
                suggestion={suggestion}
              />
            ))}
          </div>
        </section>
      )}

      {unlinked.length > 0 && (
        <section className="mt-6" id="manual">
          <h2 className="text-[15px] font-semibold">
            Runs with no session
            <span className="ml-2 fig text-[13px] font-normal text-ash">{unlinked.length}</span>
          </h2>
          <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-[14px] border border-hairline bg-slate">
            {unlinked.map((activity) => (
              <li key={activity.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <ActivityLine activity={serialise(activity)} />
                </div>
                <PickWorkout activityId={activity.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {waiting.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[15px] font-semibold">
            Sessions with no run
            <span className="ml-2 fig text-[13px] font-normal text-ash">{waiting.length}</span>
          </h2>
          <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-[14px] border border-hairline bg-slate">
            {waiting.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{w.name}</p>
                  <p className="fig mt-0.5 text-[13px] text-ash">
                    {formatDistance(w.plannedDistanceM)} ·{' '}
                    {new Date(`${w.date}T00:00:00Z`).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'UTC',
                    })}
                  </p>
                </div>
                <Link
                  href={`/today?date=${w.date}`}
                  className="shrink-0 rounded-full border border-hairline-strong px-4 py-1.5 text-[13px] font-medium"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/** Dates cross the server boundary as strings. */
function serialise(a: {
  id: string
  name: string
  startedAtLocal: Date
  distanceM: number
  movingTimeS: number
  avgPaceSPerKm: number
}): LinkableActivity {
  return { ...a, startedAtLocal: a.startedAtLocal.toISOString() }
}
