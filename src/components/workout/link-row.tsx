'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/controls'
import { formatDistance, formatDuration, formatPace } from '@/lib/units'

export type LinkableActivity = {
  id: string
  name: string
  startedAtLocal: string
  distanceM: number
  movingTimeS: number
  avgPaceSPerKm: number
}

export type Suggestion = { workoutId: string; name: string; date: string; plannedDistanceM: number; score: number }

/** One reviewable pairing: a run above, the session it probably was below. */
export function SuggestionCard({
  activity,
  suggestion,
}: {
  activity: LinkableActivity
  suggestion: Suggestion
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function link(move = false) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workoutId: suggestion.workoutId, activityId: activity.id, move }),
      })
      const body = await res.json().catch(() => null)
      if (res.status === 409) {
        setConflict(body?.error?.message ?? 'That run is already linked.')
        return
      }
      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not link that run.')
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rounded-[14px] border border-hairline bg-slate p-4">
      <ActivityLine activity={activity} />

      <div className="my-3 flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="fig text-[12px] text-ash">{Math.round(suggestion.score * 100)}% match</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-medium">{suggestion.name}</p>
        <p className="fig shrink-0 text-[13px] text-ash">{formatDistance(suggestion.plannedDistanceM)}</p>
      </div>
      <p className="mt-0.5 text-[13px] text-ash">{dayLabel(suggestion.date)}</p>

      {conflict ? (
        <div className="mt-3 rounded-[10px] border border-caution/40 bg-caution/10 p-3">
          <p className="text-[13px]">{conflict}</p>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" onClick={() => setConflict(null)} className="px-3 py-1.5 text-[13px]">
              Cancel
            </Button>
            <Button onClick={() => link(true)} disabled={busy} className="px-3 py-1.5 text-[13px]">
              Move it here
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button onClick={() => link()} disabled={busy} className="px-4 py-1.5 text-[13px]">
            {busy && <Loader2 size={13} className="animate-spin" />}
            Link
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      )}
    </article>
  )
}

export function ActivityLine({ activity }: { activity: LinkableActivity }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-medium">{activity.name}</p>
        <p className="shrink-0 text-[13px] text-ash">{dayLabel(activity.startedAtLocal)}</p>
      </div>
      <p className="fig mt-0.5 text-[13px] text-ash">
        {formatDistance(activity.distanceM)} · {formatDuration(activity.movingTimeS)} ·{' '}
        {formatPace(activity.avgPaceSPerKm)}
      </p>
    </div>
  )
}

function dayLabel(input: string): string {
  const d = new Date(input.length === 10 ? `${input}T00:00:00Z` : input)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
