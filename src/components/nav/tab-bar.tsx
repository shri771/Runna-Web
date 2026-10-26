'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, CalendarDays, ClipboardList, Link2, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Bottom tab bar on mobile, left sidebar from 1024px.
 * Settings is reached from the avatar in the header, not from here.
 */
const TABS = [
  { href: '/today', label: 'Today', icon: Sun },
  { href: '/plan', label: 'Plan', icon: ClipboardList },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/link', label: 'Link', icon: Link2 },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
] as const

export function TabBar({ reviewCount = 0 }: { reviewCount?: number }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex border-t border-hairline bg-ink/95 backdrop-blur',
        'pb-[env(safe-area-inset-bottom)]',
        'lg:inset-y-0 lg:right-auto lg:left-0 lg:w-60 lg:flex-col lg:border-t-0 lg:border-r lg:pt-6',
      )}
    >
      <div className="hidden px-5 pb-8 lg:block">
        <span className="text-lg font-semibold tracking-tight">Runna Web</span>
      </div>

      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium',
              'lg:w-full lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:px-5 lg:py-3 lg:text-sm',
              active ? 'text-chalk' : 'text-ash hover:text-chalk',
            )}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
              {href === '/link' && reviewCount > 0 && (
                <span
                  className="absolute -top-1 -right-2 min-w-[16px] rounded-full bg-chalk px-1 text-[10px] font-bold text-ink"
                  aria-label={`${reviewCount} to review`}
                >
                  {reviewCount}
                </span>
              )}
            </span>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
