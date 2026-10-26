'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { Button, Card, Field, Input } from '@/components/ui/controls'
import { registerSchema } from '@/lib/validation/plan'

type Mode = 'sign-in' | 'sign-up'
type FieldErrors = Partial<Record<'name' | 'email' | 'password', string>>

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') ?? '/today'

  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const isSignUp = mode === 'sign-up'

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return // a double submit must never create two accounts

    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '')
    const email = String(data.get('email') ?? '')
    const password = String(data.get('password') ?? '')

    setFieldErrors({})
    setFormError(null)

    if (isSignUp) {
      const parsed = registerSchema.safeParse({ name, email, password, timezone: tz() })
      if (!parsed.success) {
        const errors: FieldErrors = {}
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as keyof FieldErrors
          if (key && !errors[key]) errors[key] = issue.message
        }
        setFieldErrors(errors)
        return
      }
    }

    setPending(true)
    try {
      if (isSignUp) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, email, password, timezone: tz() }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          setFormError(body?.error?.message ?? 'Could not create your account.')
          return
        }
      }

      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        setFormError('That email and password do not match.')
        return
      }
      router.push(isSignUp ? '/onboarding' : next)
      router.refresh()
    } catch {
      setFormError('Could not reach the server. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <h1 className="text-[22px] font-semibold tracking-tight">
        {isSignUp ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mt-1 text-[14px] text-ash">
        {isSignUp ? 'Then we will build your plan.' : 'Sign in to pick up your plan.'}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {isSignUp && (
          <Field label="Name" error={fieldErrors.name}>
            <Input name="name" autoComplete="name" required aria-invalid={!!fieldErrors.name} />
          </Field>
        )}

        <Field label="Email" error={fieldErrors.email}>
          <Input name="email" type="email" autoComplete="email" required aria-invalid={!!fieldErrors.email} />
        </Field>

        <Field label="Password" hint={isSignUp ? 'At least 8 characters.' : undefined} error={fieldErrors.password}>
          <Input
            name="password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            required
            aria-invalid={!!fieldErrors.password}
          />
        </Field>

        {formError && (
          <p role="alert" className="rounded-[10px] border border-danger/40 bg-danger/10 p-3 text-[13px] text-danger">
            {formError}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 size={16} className="animate-spin" />}
          {isSignUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-5 text-center text-[14px] text-ash">
        {isSignUp ? 'Already have an account? ' : 'New here? '}
        <Link href={isSignUp ? '/sign-in' : '/sign-up'} className="font-medium text-chalk hover:underline">
          {isSignUp ? 'Sign in' : 'Create one'}
        </Link>
      </p>
    </Card>
  )
}
