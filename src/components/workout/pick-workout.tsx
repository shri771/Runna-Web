'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDistance } from '@/lib/units'

type Candidate = {
  workoutId: string
  name: string
  date: string
  plannedDistanceM: number
  score: number
  deltaM: number
}

/** "Link to…" — fetches candidate sessions for one run and links the chosen one. */
export function PickWorkout({ activityId }: { activityId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function load() {
    setOpen(true)
    if (candidates) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/link?activityId=${activityId}`)
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not load sessions.')
        return
      }
      setCandidates(body.candidates ?? [])
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  async function link(workoutId: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workoutId, activityId }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not link that run.')
        return
      }
      setOpen(false)
      startTransition(() => router.refresh())
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={load}
        className="shrink-0 rounded-full border border-hairline-strong px-4 py-1.5 text-[13px] font-medium hover:bg-slate-2"
      >
        Link to…
      </button>
    )
  }

  return (
    <div className="w-full max-w-[280px] shrink-0 rounded-[10px] border border-hairline-strong bg-slate-2 p-2">
      {loading && (
        <p className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-ash">
          <Loader2 size={13} className="animate-spin" /> Loading
        </p>
      )}

      {error && (
        <p role="alert" className="px-2 py-1.5 text-[13px] text-danger">
          {error}
        </p>
      )}

      {candidates?.length === 0 && !loading && (
        <p className="px-2 py-1.5 text-[13px] text-ash">No sessions within a week of this run.</p>
      )}

      <ul className="max-h-[220px] overflow-y-auto">
        {candidates?.map((c) => (
          <li key={c.workoutId}>
            <button
              type="button"
              onClick={() => link(c.workoutId)}
              disabled={loading}
              className={cn(
                'flex w-full items-baseline justify-between gap-2 rounded-[7px] px-2 py-1.5 text-left hover:bg-slate-3',
                c.score >= 0.75 && 'bg-chalk/5',
              )}
            >
              <span className="min-w-0 truncate text-[13px]">{c.name}</span>
              <span className="fig shrink-0 text-[12px] text-ash">
                {formatDistance(c.plannedDistanceM)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-1 w-full rounded-[7px] px-2 py-1.5 text-[13px] text-ash hover:text-chalk"
      >
        Cancel
      </button>
    </div>
  )
}
