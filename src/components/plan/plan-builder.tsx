'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Check, Loader2 } from 'lucide-react'
import { MileageChart, type ChartWeek } from '@/components/plan/mileage-chart'
import { Button, Card, Field, Input, OptionCard, Segmented, Slider } from '@/components/ui/controls'
import { cn } from '@/lib/cn'
import type { PlanIssue, PaceZones } from '@/lib/plan-engine/types'
import { formatDistance, formatPaceRange } from '@/lib/units'

const DRAFT_KEY = 'runna:plan-draft'
const DAY_NAMES = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

type Draft = {
  goal: 'FIVE_K' | 'TEN_K' | 'HALF' | 'MARATHON' | 'BUILD_MILEAGE'
  raceDate: string
  planWeeks: number
  raceName: string
  daysPerWeek: number
  preferredDays: number[]
  longRunDay: number
  ability: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  currentWeeklyKm: number
  currentLongestKm: number
  targetWeeklyKm: number
  progression: 'GRADUAL' | 'STEADY' | 'AGGRESSIVE'
  paceKind: 'RACE_RESULT' | 'ESTIMATED_5K' | 'NONE'
  raceResultDistanceM: number
  raceResultTime: string
  estimated5kTime: string
}

type Summary = {
  totalWeeks: number
  totalDistanceM: number
  peakWeeklyM: number
  longestRunM: number
  workoutCount: number
  weeks: ChartWeek[]
}

const STEPS = ['Goal', 'When', 'Your week', 'Where you are', 'Your pace', 'How hard'] as const

function nextMonday(): string {
  const d = new Date()
  d.setDate(d.getDate() + ((8 - (d.getDay() || 7)) % 7 || 7))
  return d.toISOString().slice(0, 10)
}

const DEFAULT_DRAFT: Draft = {
  goal: 'HALF',
  raceDate: '',
  planWeeks: 12,
  raceName: '',
  daysPerWeek: 4,
  preferredDays: [1, 3, 5, 6],
  longRunDay: 6,
  ability: 'INTERMEDIATE',
  currentWeeklyKm: 25,
  currentLongestKm: 10,
  targetWeeklyKm: 40,
  progression: 'STEADY',
  paceKind: 'ESTIMATED_5K',
  raceResultDistanceM: 10000,
  raceResultTime: '50:00',
  estimated5kTime: '25:00',
}

/** "50:00" / "1:45:30" → seconds. Returns null when unparseable. */
function parseTime(input: string): number | null {
  const parts = input.trim().split(':').map(Number)
  if (parts.length === 0 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
  return null
}

function toRequest(d: Draft) {
  const paceBasis =
    d.paceKind === 'RACE_RESULT'
      ? { kind: 'RACE_RESULT' as const, distanceM: d.raceResultDistanceM, timeS: parseTime(d.raceResultTime) ?? 0 }
      : d.paceKind === 'ESTIMATED_5K'
        ? { kind: 'ESTIMATED_5K' as const, timeS: parseTime(d.estimated5kTime) ?? 0 }
        : undefined

  return {
    goal: d.goal,
    ...(d.goal === 'BUILD_MILEAGE' ? { planWeeks: d.planWeeks } : { raceDate: d.raceDate }),
    startDate: nextMonday(),
    raceName: d.raceName || undefined,
    daysPerWeek: d.daysPerWeek,
    preferredDays: d.preferredDays,
    longRunDay: d.longRunDay,
    ability: d.ability,
    currentWeeklyKm: d.currentWeeklyKm,
    currentLongestKm: d.currentLongestKm,
    targetWeeklyKm: d.targetWeeklyKm,
    progression: d.progression,
    ...(paceBasis && paceBasis.timeS > 0 ? { paceBasis } : {}),
    units: 'KM' as const,
  }
}

export function PlanBuilder() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
  const [hydrated, setHydrated] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [zones, setZones] = useState<PaceZones | null>(null)
  const [issues, setIssues] = useState<PlanIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const router = useRouter()

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }, [])

  // Restore a draft so a refresh mid-signup does not lose the answers.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) setDraft({ ...DEFAULT_DRAFT, ...JSON.parse(saved) })
    } catch {
      // Private mode or cleared storage — start fresh, not an error.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* non-fatal */
    }
  }, [draft, hydrated])

  // Live preview, debounced so dragging a slider does not hammer the server.
  useEffect(() => {
    if (!hydrated) return
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setPreviewError(null)
      try {
        const res = await fetch('/api/plans/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(toRequest(draft)),
          signal: controller.signal,
        })
        const body = await res.json()
        if (!res.ok) {
          setPreviewError(body?.error?.message ?? 'Could not build a preview.')
          return
        }
        setIssues(body.issues ?? [])
        setZones(body.paceZones ?? null)
        // Keep the previous curve on screen when a step is mid-edit, rather
        // than collapsing the chart to empty.
        if (body.summary) setSummary(body.summary)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setPreviewError('Could not reach the server.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [draft, hydrated])

  const errors = useMemo(() => issues.filter((i) => i.severity === 'error'), [issues])
  const warnings = useMemo(() => issues.filter((i) => i.severity === 'warning'), [issues])
  const blocked = errors.length > 0
  const isLast = step === STEPS.length - 1

  const applyPatch = (patch: Record<string, unknown>) => setDraft((d) => ({ ...d, ...patch }))

  async function createPlan(archiveFirst = false) {
    if (creating) return // a double click must never write two plans
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...toRequest(draft), archiveFirst }),
      })
      const body = await res.json().catch(() => null)

      if (res.status === 409 && body?.error?.code === 'PLAN_ALREADY_ACTIVE') {
        setCreateError('REPLACE')
        return
      }
      if (!res.ok) {
        setCreateError(body?.error?.message ?? 'Could not create your plan.')
        return
      }

      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* non-fatal */
      }
      router.push('/today?created=1')
      router.refresh()
    } catch {
      setCreateError('Could not reach the server. Your answers are saved — try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 lg:px-8">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} aria-label="Back" className="text-ash hover:text-chalk">
              <ArrowLeft size={20} />
            </button>
          )}
          <p className="unit">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </p>
        </div>
        <div className="mt-2 flex gap-1" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          {STEPS.map((s, i) => (
            <span key={s} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-chalk' : 'bg-slate-3')} />
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <Card className="min-h-[360px]">
          {step === 0 && <StepGoal draft={draft} set={set} />}
          {step === 1 && <StepWhen draft={draft} set={set} />}
          {step === 2 && <StepWeek draft={draft} set={set} />}
          {step === 3 && <StepFitness draft={draft} set={set} />}
          {step === 4 && <StepPace draft={draft} set={set} zones={zones} />}
          {step === 5 && <StepVolume draft={draft} set={set} />}
        </Card>

        <aside className="lg:sticky lg:top-6">
          <Preview
            summary={summary}
            loading={loading}
            error={previewError}
            errors={errors}
            warnings={warnings}
            onApply={applyPatch}
          />
        </aside>
      </div>

      {createError === 'REPLACE' ? (
        <div className="mt-6 rounded-[14px] border border-caution/40 bg-caution/10 p-4">
          <p className="text-[14px]">You already have an active plan.</p>
          <p className="mt-0.5 text-[13px] text-ash">
            Replacing it archives the old one. Your completed runs stay in your history.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/plan')}>
              Open my plan
            </Button>
            <Button onClick={() => createPlan(true)} disabled={creating}>
              Replace it
            </Button>
          </div>
        </div>
      ) : (
        createError && (
          <p role="alert" className="mt-6 rounded-[14px] border border-danger/40 bg-danger/10 p-4 text-[13px] text-danger">
            {createError}
          </p>
        )
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Back
        </Button>

        {isLast ? (
          <Button onClick={() => createPlan()} disabled={blocked || loading || creating || !summary}>
            {loading || creating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {creating ? 'Building your plan' : 'Create my plan'}
          </Button>
        ) : (
          <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------- steps

type StepProps = { draft: Draft; set: <K extends keyof Draft>(k: K, v: Draft[K]) => void }

function StepGoal({ draft, set }: StepProps) {
  const goals = [
    { value: 'FIVE_K', title: '5K', hint: '4+ weeks' },
    { value: 'TEN_K', title: '10K', hint: '6+ weeks' },
    { value: 'HALF', title: 'Half marathon', hint: '8+ weeks' },
    { value: 'MARATHON', title: 'Marathon', hint: '12+ weeks' },
  ] as const

  return (
    <section>
      <h2 className="text-[22px] font-semibold tracking-tight">What are you training for?</h2>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {goals.map((g) => (
          <OptionCard key={g.value} selected={draft.goal === g.value} title={g.title} hint={g.hint} onClick={() => set('goal', g.value)} />
        ))}
      </div>
      <OptionCard
        className="mt-3 w-full"
        selected={draft.goal === 'BUILD_MILEAGE'}
        title="Just build my mileage"
        hint="No race — pick a block length"
        onClick={() => set('goal', 'BUILD_MILEAGE')}
      />
    </section>
  )
}

function StepWhen({ draft, set }: StepProps) {
  return (
    <section className="space-y-5">
      <h2 className="text-[22px] font-semibold tracking-tight">
        {draft.goal === 'BUILD_MILEAGE' ? 'How long a block?' : 'When is your race?'}
      </h2>

      {draft.goal === 'BUILD_MILEAGE' ? (
        <Slider label="Plan length" value={draft.planWeeks} min={4} max={52} suffix=" wks" onChange={(v) => set('planWeeks', v)} />
      ) : (
        <>
          <Field label="Race date">
            <Input type="date" value={draft.raceDate} min={nextMonday()} onChange={(e) => set('raceDate', e.target.value)} />
          </Field>
          <Field label="Race name" hint="Optional — shown on your plan">
            <Input placeholder="City Half" value={draft.raceName} onChange={(e) => set('raceName', e.target.value)} />
          </Field>
        </>
      )}
      <p className="text-[13px] text-ash">Your plan starts Monday {nextMonday()}.</p>
    </section>
  )
}

function StepWeek({ draft, set }: StepProps) {
  const toggleDay = (day: number) => {
    const next = draft.preferredDays.includes(day)
      ? draft.preferredDays.filter((d) => d !== day)
      : [...draft.preferredDays, day].sort((a, b) => a - b)
    set('preferredDays', next)
    if (!next.includes(draft.longRunDay) && next.length > 0) set('longRunDay', next[next.length - 1]!)
  }

  return (
    <section className="space-y-6">
      <h2 className="text-[22px] font-semibold tracking-tight">What does your week look like?</h2>

      <Field label="Runs per week">
        <Segmented
          label="Runs per week"
          value={draft.daysPerWeek}
          onChange={(v) => set('daysPerWeek', v)}
          options={[2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}
        />
      </Field>

      <Field label="Which days can you run?" hint={`Pick at least ${draft.daysPerWeek}.`}>
        <div className="flex gap-1.5">
          {DAY_NAMES.map((d, i) => {
            const on = draft.preferredDays.includes(i)
            return (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                aria-label={DAY_FULL[i]}
                onClick={() => toggleDay(i)}
                className={cn(
                  'flex-1 rounded-[10px] border py-2.5 text-[14px] font-semibold transition',
                  on ? 'border-chalk bg-chalk/10' : 'border-hairline bg-slate-2 text-ash hover:text-chalk',
                )}
              >
                {d}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Long run day">
        <select
          value={draft.longRunDay}
          onChange={(e) => set('longRunDay', Number(e.target.value))}
          className="w-full rounded-[10px] border border-hairline bg-slate-2 px-3 py-2.5 text-[15px]"
        >
          {draft.preferredDays.map((d) => (
            <option key={d} value={d}>
              {DAY_FULL[d]}
            </option>
          ))}
        </select>
      </Field>
    </section>
  )
}

function StepFitness({ draft, set }: StepProps) {
  return (
    <section className="space-y-6">
      <h2 className="text-[22px] font-semibold tracking-tight">Where are you now?</h2>

      <Field label="How would you describe yourself?">
        <div className="grid gap-2">
          {(
            [
              ['BEGINNER', 'Beginner', 'New to running, or coming back'],
              ['INTERMEDIATE', 'Intermediate', 'Running regularly, raced before'],
              ['ADVANCED', 'Advanced', 'Structured training, chasing times'],
            ] as const
          ).map(([value, title, hint]) => (
            <OptionCard key={value} selected={draft.ability === value} title={title} hint={hint} onClick={() => set('ability', value)} />
          ))}
        </div>
      </Field>

      <Slider
        label="Current weekly distance"
        value={draft.currentWeeklyKm}
        min={0}
        max={120}
        suffix="km"
        onChange={(v) => {
          set('currentWeeklyKm', v)
          // The longest run can never exceed the week, so move its cap with it
          // rather than erroring about the combination later.
          if (draft.currentLongestKm > v) set('currentLongestKm', v)
          if (draft.targetWeeklyKm < v) set('targetWeeklyKm', v)
        }}
      />

      <Slider
        label="Longest recent run"
        value={draft.currentLongestKm}
        min={0}
        max={Math.max(1, draft.currentWeeklyKm)}
        suffix="km"
        onChange={(v) => set('currentLongestKm', v)}
        footnote="capped at your weekly distance"
      />
    </section>
  )
}

function StepPace({ draft, set, zones }: StepProps & { zones: PaceZones | null }) {
  return (
    <section className="space-y-5">
      <h2 className="text-[22px] font-semibold tracking-tight">How fast do you run?</h2>
      <p className="text-[14px] text-ash">
        This sets the pace target on every interval. A recent race is most accurate.
      </p>

      <Segmented
        label="Pace basis"
        value={draft.paceKind}
        onChange={(v) => set('paceKind', v)}
        options={[
          { value: 'RACE_RESULT', label: 'Recent race' },
          { value: 'ESTIMATED_5K', label: '5K time' },
          { value: 'NONE', label: 'Not sure' },
        ]}
      />

      {draft.paceKind === 'RACE_RESULT' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Distance">
            <select
              value={draft.raceResultDistanceM}
              onChange={(e) => set('raceResultDistanceM', Number(e.target.value))}
              className="w-full rounded-[10px] border border-hairline bg-slate-2 px-3 py-2.5 text-[15px]"
            >
              <option value={5000}>5K</option>
              <option value={10000}>10K</option>
              <option value={21097}>Half marathon</option>
              <option value={42195}>Marathon</option>
            </select>
          </Field>
          <Field label="Time" hint="mm:ss or h:mm:ss">
            <Input value={draft.raceResultTime} onChange={(e) => set('raceResultTime', e.target.value)} placeholder="50:00" />
          </Field>
        </div>
      )}

      {draft.paceKind === 'ESTIMATED_5K' && (
        <Field label="Your 5K time" hint="A best guess is fine.">
          <Input value={draft.estimated5kTime} onChange={(e) => set('estimated5kTime', e.target.value)} placeholder="25:00" />
        </Field>
      )}

      {draft.paceKind === 'NONE' && (
        <p className="rounded-[12px] border border-hairline bg-slate-2 p-3 text-[13px] text-ash">
          We will estimate from your ability level and you can refine it later.
        </p>
      )}

      {zones && (
        <div className="rounded-[12px] border border-hairline bg-slate-2 p-4">
          <p className="unit">Your training paces</p>
          <dl className="mt-2 space-y-1.5">
            {(['EASY', 'LONG', 'THRESHOLD', 'INTERVAL'] as const).map((z) => (
              <div key={z} className="flex justify-between text-[14px]">
                <dt className="text-ash capitalize">{z.toLowerCase()}</dt>
                <dd className="tabular font-medium">{formatPaceRange(zones[z])}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  )
}

function StepVolume({ draft, set }: StepProps) {
  return (
    <section className="space-y-6">
      <h2 className="text-[22px] font-semibold tracking-tight">How hard do you want to build?</h2>

      <Slider
        label="Target weekly distance"
        value={draft.targetWeeklyKm}
        min={Math.max(1, Math.round(draft.currentWeeklyKm))}
        max={150}
        suffix="km"
        onChange={(v) => set('targetWeeklyKm', v)}
        footnote={`now ${draft.currentWeeklyKm}km`}
      />

      <Field label="How quickly to build up">
        <Segmented
          label="Progression"
          value={draft.progression}
          onChange={(v) => set('progression', v)}
          options={[
            { value: 'GRADUAL', label: 'Gradual', hint: '+4%/wk' },
            { value: 'STEADY', label: 'Steady', hint: '+7%/wk' },
            { value: 'AGGRESSIVE', label: 'Aggressive', hint: '+10%/wk' },
          ]}
        />
      </Field>

      <p className="text-[13px] text-ash">
        Your target is a ceiling, not a destination. When the plan reaches it, the weeks that follow
        get harder rather than longer.
      </p>
    </section>
  )
}

// --------------------------------------------------------------- preview

function Preview({
  summary,
  loading,
  error,
  errors,
  warnings,
  onApply,
}: {
  summary: Summary | null
  loading: boolean
  error: string | null
  errors: PlanIssue[]
  warnings: PlanIssue[]
  onApply: (patch: Record<string, unknown>) => void
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="unit">Your plan</p>
        {loading && <Loader2 size={14} className="animate-spin text-ash" aria-label="Updating" />}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      {summary ? (
        <div className={cn('mt-3 transition-opacity', loading && 'opacity-40')}>
          <MileageChart weeks={summary.weeks} />
          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-[14px]">
            <dt className="text-ash">Weeks</dt>
            <dd className="tabular text-right font-semibold">{summary.totalWeeks}</dd>
            <dt className="text-ash">Workouts</dt>
            <dd className="tabular text-right font-semibold">{summary.workoutCount}</dd>
            <dt className="text-ash">Peak week</dt>
            <dd className="tabular text-right font-semibold">{formatDistance(summary.peakWeeklyM)}</dd>
            <dt className="text-ash">Longest run</dt>
            <dd className="tabular text-right font-semibold">{formatDistance(summary.longestRunM)}</dd>
            <dt className="text-ash">Total</dt>
            <dd className="tabular text-right font-semibold">{formatDistance(summary.totalDistanceM, 'KM', 0)}</dd>
          </dl>
        </div>
      ) : (
        !error && <p className="mt-3 text-[13px] text-ash">Answer the questions to see your plan take shape.</p>
      )}

      {[...errors, ...warnings].map((issue) => (
        <div
          key={issue.code + issue.message}
          className={cn(
            'mt-3 rounded-[12px] border p-3',
            issue.severity === 'error' ? 'border-danger/40 bg-danger/10' : 'border-caution/40 bg-caution/10',
          )}
        >
          <p className="flex gap-2 text-[13px]">
            <AlertTriangle size={15} className={issue.severity === 'error' ? 'shrink-0 text-danger' : 'shrink-0 text-caution'} />
            {issue.message}
          </p>
          {issue.suggestions && issue.suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {issue.suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => onApply(s.patch as Record<string, unknown>)}
                  className="rounded-full border border-hairline-strong px-3 py-1 text-[12px] font-medium hover:bg-slate-2"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </Card>
  )
}
