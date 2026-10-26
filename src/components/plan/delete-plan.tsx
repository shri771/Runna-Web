'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/controls'

/**
 * Deleting a plan is irreversible, so it states the consequences before it
 * happens rather than after.
 */
export function DeletePlan({ workoutCount }: { workoutCount: number }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/plans', { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not delete the plan.')
        return
      }
      router.push('/onboarding')
      router.refresh()
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setPending(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-[15px] text-ash transition hover:text-danger"
      >
        Delete this plan
        <Trash2 size={16} />
      </button>
    )
  }

  return (
    <div className="border-t border-hairline p-4">
      <p className="text-[15px] font-medium">Delete this plan?</p>
      <ul className="mt-2 space-y-1 text-[13px] text-ash">
        <li>· {workoutCount} sessions will be removed, including completed ones</li>
        <li>· Runs you have logged are kept — they are your record, not the plan&apos;s</li>
        <li>· You will be taken to build a new plan</li>
        <li>· This cannot be undone</li>
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Keep it
        </Button>
        <Button
          onClick={remove}
          disabled={pending}
          className="bg-danger text-chalk hover:brightness-110"
        >
          {pending && <Loader2 size={15} className="animate-spin" />}
          Delete plan
        </Button>
      </div>
    </div>
  )
}
