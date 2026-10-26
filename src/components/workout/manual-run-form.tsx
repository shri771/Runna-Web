'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui/controls'

/**
 * Log a run by hand.
 *
 * Without a Strava connection this is the only way runs get into the app, so
 * it has to be a real, complete form rather than a placeholder.
 */
export function ManualRunForm({ defaultDate }: { defaultDate: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const data = new FormData(event.currentTarget)
    const body = {
      name: String(data.get('name') || 'Run'),
      date: String(data.get('date')),
      distanceKm: Number(data.get('distanceKm')),
      durationMin: Number(data.get('durationMin')),
    }

    setError(null)
    setFieldError(null)

    if (!Number.isFinite(body.distanceKm) || body.distanceKm <= 0) {
      setFieldError('How far did you go?')
      return
    }
    if (!Number.isFinite(body.durationMin) || body.durationMin <= 0) {
      setFieldError('How long did it take?')
      return
    }

    setPending(true)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error?.message ?? 'Could not save that run.')
        return
      }
      setOpen(false)
      startTransition(() => router.refresh())
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus size={16} /> Log a run
      </Button>
    )
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[14px] border border-hairline bg-slate-2 p-4">
      <h3 className="text-[15px] font-semibold">Log a run</h3>
      <p className="mt-0.5 text-[13px] text-ash">
        It will be offered against any session within a day of this date.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="What was it?">
          <Input name="name" defaultValue="Morning run" maxLength={80} />
        </Field>
        <Field label="When">
          <Input name="date" type="date" defaultValue={defaultDate} max={defaultDate} required />
        </Field>
        <Field label="Distance (km)">
          <Input name="distanceKm" type="number" step="0.01" min="0.1" placeholder="6.1" required />
        </Field>
        <Field label="Time (minutes)">
          <Input name="durationMin" type="number" step="0.1" min="1" placeholder="32" required />
        </Field>
      </div>

      {(fieldError || error) && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {fieldError ?? error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 size={15} className="animate-spin" />}
          Save run
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
