import { Suspense } from 'react'
import { AuthForm } from '@/components/auth/auth-form'

export const metadata = { title: 'Create an account — Runna Web' }

export default function SignUpPage() {
  return (
    <Suspense>
      <AuthForm mode="sign-up" />
    </Suspense>
  )
}
