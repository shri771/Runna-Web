import { Suspense } from 'react'
import { AuthForm } from '@/components/auth/auth-form'
import { isGoogleEnabled } from '@/lib/auth'

export const metadata = { title: 'Sign in — Runna Web' }

export default function SignInPage() {
  return (
    <Suspense>
      <AuthForm mode="sign-in" googleEnabled={isGoogleEnabled()} />
    </Suspense>
  )
}
