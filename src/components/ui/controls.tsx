'use client'

import { cn } from '@/lib/cn'

/**
 * Cards come in two weights. `raised` is for the one thing a screen is about;
 * everything else is `quiet`. Identical cards everywhere is what makes an
 * interface read flat.
 */
export function Card({
  weight = 'quiet',
  className,
  ...props
}: React.ComponentProps<'div'> & { weight?: 'raised' | 'quiet' }) {
  return (
    <div
      className={cn(
        'rounded-[14px] border',
        weight === 'raised' ? 'border-hairline-strong bg-slate' : 'border-hairline bg-slate/60',
        'p-5',
        className,
      )}
      {...props}
    />
  )
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full text-[15px] font-semibold',
        'px-5 py-2.5 transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'bg-amber text-ink hover:bg-amber-bright active:bg-amber',
        variant === 'secondary' &&
          'border border-hairline-strong text-chalk hover:border-ash hover:bg-slate-2',
        variant === 'ghost' && 'text-ash hover:text-chalk',
        variant === 'danger' && 'bg-danger text-chalk hover:brightness-110',
        className,
      )}
      {...props}
    />
  )
}

export function OptionCard({
  selected,
  title,
  hint,
  className,
  ...props
}: React.ComponentProps<'button'> & { selected: boolean; title: string; hint?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'rounded-[12px] border px-4 py-3.5 text-left transition-colors duration-150',
        selected
          ? 'border-amber bg-amber/10'
          : 'border-hairline bg-slate-2/70 hover:border-hairline-strong',
        className,
      )}
      {...props}
    >
      <span className={cn('block text-[15px] font-semibold', selected ? 'text-amber' : 'text-chalk')}>
        {title}
      </span>
      {hint && <span className="mt-0.5 block text-[13px] text-ash">{hint}</span>}
    </button>
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; hint?: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-1 rounded-[11px] border border-hairline bg-slate-2/70 p-1"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-[8px] px-2 py-1.5 text-center transition-colors duration-150',
              active ? 'bg-amber text-ink' : 'text-ash hover:text-chalk',
            )}
          >
            <span className="block text-[14px] font-semibold">{o.label}</span>
            {o.hint && (
              <span className={cn('block text-[11px]', active ? 'text-ink/70' : 'text-ash-dim')}>
                {o.hint}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  footnote,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix: string
  onChange: (v: number) => void
  footnote?: string
}) {
  const id = `slider-${label.replace(/\s+/g, '-').toLowerCase()}`
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14px] font-medium">
          {label}
        </label>
        <span className="fig text-[22px] leading-none font-bold text-amber">
          {value}
          <span className="ml-0.5 text-[13px] font-medium text-ash">{suffix}</span>
        </span>
      </div>

      <div className="relative mt-3">
        {/* A filled track reads as progress toward the target, which is what
            this control actually represents. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full bg-amber"
          style={{ width: `${pct}%` }}
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full cursor-pointer"
        />
      </div>

      <div className="mt-1.5 flex justify-between text-[11px] text-ash-dim">
        <span className="fig">
          {min}
          {suffix}
        </span>
        {footnote && <span className="text-ash">{footnote}</span>}
        <span className="fig">
          {max}
          {suffix}
        </span>
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[14px] font-medium">{label}</label>
      {hint && <p className="mt-0.5 text-[13px] text-ash">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'w-full rounded-[10px] border border-hairline bg-slate-2 px-3 py-2.5 text-[15px]',
        'placeholder:text-ash-dim',
        'transition-colors focus:border-amber focus:outline-none',
        'aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  )
}

/** Plain select styled to match Input — the native one is unusable on dark. */
export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'w-full appearance-none rounded-[10px] border border-hairline bg-slate-2 px-3 py-2.5 text-[15px]',
        'transition-colors focus:border-amber focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}
