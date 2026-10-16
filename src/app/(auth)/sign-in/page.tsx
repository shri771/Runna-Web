import { Suspense } from 'react'
import { AuthForm } from '@/components/auth/auth-form'

export const metadata = { title: 'Sign in — Runna Web' }

export default function SignInPage() {
  return (
    <Suspense>
      <AuthForm mode="sign-in" />
    </Suspense>
  )
}
