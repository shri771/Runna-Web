'use client'

import { cn } from '@/lib/cn'

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-[16px] border border-hairline bg-slate p-5', className)} {...props} />
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'bg-amber text-ink hover:brightness-110',
        variant === 'secondary' && 'border border-hairline-strong text-chalk hover:bg-slate-2',
        variant === 'ghost' && 'text-ash hover:text-chalk',
        className,
      )}
      {...props}
    />
  )
}

/** Large tappable choice card — the goal and ability steps. */
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
        'rounded-[12px] border p-4 text-left transition',
        selected
          ? 'border-amber bg-amber/10 text-chalk'
          : 'border-hairline bg-slate-2 text-ash hover:border-hairline-strong hover:text-chalk',
        className,
      )}
      {...props}
    >
      <span className="block text-[15px] font-semibold text-chalk">{title}</span>
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
    <div role="group" aria-label={label} className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-[10px] border px-2 py-2 text-center transition',
            o.value === value
              ? 'border-amber bg-amber/10'
              : 'border-hairline bg-slate-2 hover:border-hairline-strong',
          )}
        >
          <span className="block text-[14px] font-semibold">{o.label}</span>
          {o.hint && <span className="block text-[11px] text-ash">{o.hint}</span>}
        </button>
      ))}
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
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={label} className="text-[14px] font-medium">
          {label}
        </label>
        <span className="tabular text-[17px] font-semibold">
          {value}
          <span className="ml-0.5 text-[13px] text-ash">{suffix}</span>
        </span>
      </div>
      <input
        id={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-3 accent-[var(--color-brand)]"
      />
      <div className="mt-1 flex justify-between text-[11px] text-ash-dim tabular">
        <span>
          {min}
          {suffix}
        </span>
        {footnote && <span className="text-ash">{footnote}</span>}
        <span>
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
        'placeholder:text-ash-dim focus:border-hairline-strong focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}
