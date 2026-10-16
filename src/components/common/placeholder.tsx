import { cn } from '@/lib/cn'

/**
 * Scaffold marker. Each app route renders one of these until its real screen
 * lands, so navigation works end-to-end from day one and no route is a blank
 * page. Delete as screens are built.
 */
export function Placeholder({
  screen,
  spec,
  features,
  className,
}: {
  screen: string
  spec: string
  features: string[]
  className?: string
}) {
  return (
    <section
      className={cn('rounded-[16px] border border-border bg-surface p-5', className)}
      aria-label={`${screen} — not built yet`}
    >
      <p className="label">Not built yet</p>
      <h2 className="mt-1 text-[17px] font-semibold">{screen}</h2>
      <p className="mt-1 text-[13px] text-muted">
        Spec: <code className="text-text">{spec}</code>
      </p>
      <ul className="mt-4 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex gap-2 text-[14px] text-muted">
            <span className="text-subtle" aria-hidden>
              •
            </span>
            {f}
          </li>
        ))}
      </ul>
    </section>
  )
}
