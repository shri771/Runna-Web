import Link from 'next/link'
import { User } from 'lucide-react'

/**
 * Avatar on the left routes to settings, as in the reference screenshots.
 * The title is the week, not the screen name — the screen name is already in
 * the tab bar, and the week is the thing worth knowing.
 */
export function AppHeader({
  title,
  subtitle,
  user,
  actions,
}: {
  title: string
  subtitle?: string
  user?: { name: string | null; image: string | null }
  actions?: React.ReactNode
}) {
  return (
    <header className="flex items-center gap-3 py-4">
      <Link
        href="/settings"
        aria-label="Settings"
        className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-hairline bg-slate-2 text-ash hover:text-chalk"
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-full object-cover" />
        ) : (
          <User size={17} />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[20px] leading-tight font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-[13px] text-ash">{subtitle}</p>}
      </div>

      {actions}
    </header>
  )
}
