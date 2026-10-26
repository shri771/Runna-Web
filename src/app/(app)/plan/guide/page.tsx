import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TYPE_GUIDANCE, ZONE_GUIDANCE, type WorkoutType } from '@/lib/plan-engine'
import { WORKOUT_COLOR, WORKOUT_LABEL } from '@/lib/workout-colors'

export const metadata = { title: 'Run types — Runna Web' }

/** Ordered easiest to hardest, which is how the colour spectrum reads too. */
const ORDER: WorkoutType[] = [
  'REST',
  'RECOVERY',
  'EASY',
  'LONG',
  'TEMPO',
  'THRESHOLD',
  'INTERVALS',
  'RACE_PACE',
  'RACE',
]

export default function GuidePage() {
  return (
    <>
      <div className="py-4">
        <Link href="/plan" className="inline-flex items-center gap-1.5 text-[14px] text-ash hover:text-chalk">
          <ArrowLeft size={16} /> Plan
        </Link>
      </div>

      <h1 className="text-[24px] leading-tight font-semibold tracking-tight">Run types</h1>
      <p className="mt-2 max-w-[62ch] text-[15px] text-ash">
        Every session in your plan is one of these. The colour down the left of a workout tells you
        which, so you can read a week at a glance — cool and green is easy, warm and red is hard.
      </p>

      <div className="mt-6 space-y-3">
        {ORDER.map((type) => {
          const g = TYPE_GUIDANCE[type]
          return (
            <section key={type} className="overflow-hidden rounded-[14px] border border-hairline bg-slate">
              <div className="flex">
                <span
                  aria-hidden
                  className="w-[5px] shrink-0"
                  style={{ backgroundColor: WORKOUT_COLOR[type] || 'transparent' }}
                />
                <div className="min-w-0 flex-1 p-5">
                  <h2 className="text-[17px] font-semibold">{WORKOUT_LABEL[type]}</h2>
                  <p className="mt-1.5 max-w-[62ch] text-[14px] text-ash">{g.what}</p>
                  <p className="mt-3 max-w-[62ch] text-[14px]">
                    <span className="font-medium">How to run it. </span>
                    <span className="text-ash">{g.how}</span>
                  </p>
                  <p className="mt-2 max-w-[62ch] text-[14px]">
                    <span className="font-medium">Why it is here. </span>
                    <span className="text-ash">{g.why}</span>
                  </p>
                </div>
              </div>
            </section>
          )
        })}
      </div>

      <h2 className="mt-10 text-[20px] font-semibold tracking-tight">Effort levels</h2>
      <p className="mt-2 max-w-[62ch] text-[15px] text-ash">
        Each step of a session targets one of these. Your actual paces are on the Settings screen,
        worked out from your own fitness.
      </p>

      <dl className="mt-4 divide-y divide-hairline overflow-hidden rounded-[14px] border border-hairline bg-slate">
        {(['RECOVERY', 'EASY', 'LONG', 'MARATHON', 'THRESHOLD', 'TEN_K', 'FIVE_K', 'INTERVAL'] as const).map(
          (zone) => (
            <div key={zone} className="flex items-baseline justify-between gap-4 px-5 py-3">
              <dt className="text-[14px] font-medium">{ZONE_GUIDANCE[zone].label}</dt>
              <dd className="text-[14px] text-ash">{ZONE_GUIDANCE[zone].feel}</dd>
            </div>
          ),
        )}
      </dl>

      <div className="h-8" />
    </>
  )
}
