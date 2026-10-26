import Link from 'next/link'

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">Runna Web</span>
        <Link href="/today" className="text-[14px] text-ash hover:text-chalk">
          Open the app
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <h1 className="max-w-[18ch] text-[clamp(34px,6vw,56px)] leading-[1.05] font-semibold tracking-tight">
          Your race. Your schedule. Your plan.
        </h1>
        <p className="mt-5 max-w-[52ch] text-[17px] text-ash">
          A training plan built around how much you can actually run — with real pace targets on
          every interval, and one that rebuilds itself when your week changes.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/today"
            className="rounded-full bg-chalk px-6 py-3 text-[15px] font-semibold text-ink transition hover:brightness-110"
          >
            Build my plan
          </Link>
          <Link
            href="/plan"
            className="rounded-full border border-hairline-strong px-6 py-3 text-[15px] font-semibold transition hover:bg-slate"
          >
            See a demo plan
          </Link>
        </div>

        <ol className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            ['Tell us your race', 'Your date, your days, and how much you run now.'],
            ['Get a real plan', 'Periodised weeks, structured sessions, pace targets.'],
            ['Link your Strava runs', 'Every run matched to the workout it was meant to be.'],
          ].map(([title, body], i) => (
            <li key={title} className="rounded-[16px] border border-hairline bg-slate p-5">
              <span className="unit">Step {i + 1}</span>
              <h2 className="mt-1 text-[17px] font-semibold">{title}</h2>
              <p className="mt-1 text-[14px] text-ash">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-hairline py-6 text-[13px] text-ash-dim">
        Not affiliated with Runna or Strava. Built as an educational project.
      </footer>
    </main>
  )
}
