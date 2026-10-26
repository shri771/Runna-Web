import { cn } from '@/lib/cn'

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex items-center gap-3 py-4', className)}>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-[13px] text-ash">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
