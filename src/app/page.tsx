import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const SPECTRUM = [
  { label: 'Recovery', token: 'var(--color-w-recovery)', h: 26 },
  { label: 'Easy', token: 'var(--color-w-easy)', h: 38 },
  { label: 'Long', token: 'var(--color-w-long)', h: 62 },
  { label: 'Tempo', token: 'var(--color-w-tempo)', h: 78 },
  { label: 'Threshold', token: 'var(--color-w-threshold)', h: 92 },
  { label: 'Intervals', token: 'var(--color-w-intervals)', h: 112 },
  { label: 'Race', token: 'var(--color-w-race)', h: 132 },
]

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1040px] flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="text-[17px] font-semibold tracking-tight">Runna Web</span>
        <Link
          href="/sign-in"
          className="text-[14px] text-ash transition-colors hover:text-chalk"
        >
          Sign in
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center py-14">
        <h1 className="max-w-[16ch] text-[clamp(38px,7.5vw,68px)] leading-[0.98] font-bold tracking-[-0.03em]">
          Your race.
          <br />
          Your mileage.
          <br />
          <span className="text-amber">Your plan.</span>
        </h1>

        <p className="prose-width mt-6 text-[17px] leading-relaxed text-ash">
          Most training plans assume you can run whatever they prescribe. This one is built around
          the distance you can actually cover each week — and it rebuilds itself when that changes.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full bg-amber px-6 py-3 text-[15px] font-semibold text-ink transition-colors hover:bg-amber-bright"
          >
            Build my plan <ArrowRight size={16} />
          </Link>
          <Link
            href="/sign-in"
            className="rounded-full border border-hairline-strong px-6 py-3 text-[15px] font-semibold transition-colors hover:border-ash"
          >
            Open the demo
          </Link>
        </div>

        {/* Every session is drawn as its own intensity profile, so the clearest
            way to explain the product is to show the spectrum itself. */}
        <figure className="mt-16 border-t border-hairline pt-8">
          <div className="flex items-end gap-2 sm:gap-4" aria-hidden>
            {SPECTRUM.map((s) => (
              <div key={s.label} className="flex flex-1 flex-col items-center gap-2">
                <span
                  className="w-full rounded-t-[2px]"
                  style={{ height: s.h, backgroundColor: s.token }}
                />
                <span className="text-[10px] text-ash-dim sm:text-[11px]">{s.label}</span>
              </div>
            ))}
          </div>
          <figcaption className="prose-width mt-6 text-[15px] text-ash">
            Easy to hard, left to right. Every session in your plan is one of these, with its own
            pace target worked out from a race you have actually run.
          </figcaption>
        </figure>
      </section>

      <footer className="border-t border-hairline py-6 text-[13px] text-ash-dim">
        Not affiliated with Runna or Strava. Built as an educational project.
      </footer>
    </main>
  )
}
