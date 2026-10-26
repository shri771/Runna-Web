import { ZONE_GUIDANCE } from '@/lib/plan-engine/guidance'
import type { PaceZones, WorkoutStep } from '@/lib/plan-engine/types'
import { formatDistance, formatPaceRange } from '@/lib/units'

/**
 * The session, step by step, with the pace target for each.
 *
 * Repeat blocks nest with a bracket rather than being flattened — "5 x 400m"
 * is how a runner holds the session in their head, so that is how it reads.
 */
export function StepList({ steps, zones }: { steps: WorkoutStep[]; zones: PaceZones }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((step, i) => (
        <StepRow key={i} step={step} zones={zones} index={i + 1} />
      ))}
    </ol>
  )
}

function StepRow({ step, zones, index }: { step: WorkoutStep; zones: PaceZones; index: number }) {
  if (step.kind === 'REPEAT') {
    return (
      <li>
        <div className="rounded-[10px] border border-hairline-strong bg-slate-2/60 p-2.5">
          <p className="text-[12px] font-semibold text-ash">Repeat &times;{step.count}</p>
          <ol className="mt-1.5 space-y-1">
            {step.children.map((child, i) => (
              <StepRow key={i} step={child} zones={zones} index={i + 1} />
            ))}
          </ol>
        </div>
      </li>
    )
  }

  const zone = ZONE_GUIDANCE[step.zone]
  const amount = step.distanceM
    ? formatDistance(step.distanceM)
    : step.durationS
      ? `${Math.round(step.durationS / 60)} min`
      : ''

  return (
    <li className="flex items-baseline gap-3 rounded-[8px] px-2.5 py-2 odd:bg-slate-2/40">
      <span className="fig w-4 shrink-0 text-[12px] text-ash-dim">{index}</span>
      <span className="min-w-0 flex-1">
        <span className="text-[14px]">{step.label ?? KIND_LABEL[step.kind]}</span>
        <span className="ml-2 text-[12px] text-ash-dim">{zone.feel}</span>
      </span>
      <span className="fig shrink-0 text-[14px] font-semibold">{amount}</span>
      <span className="fig w-[108px] shrink-0 text-right text-[13px] text-ash">
        {formatPaceRange(zones[step.zone])}
      </span>
    </li>
  )
}

const KIND_LABEL: Record<string, string> = {
  WARMUP: 'Warm up',
  COOLDOWN: 'Cool down',
  RUN: 'Run',
  RECOVERY: 'Recover',
}
