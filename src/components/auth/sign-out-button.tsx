'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/' })}
      className="flex w-full items-center justify-between px-4 py-3.5 text-[15px] text-ash transition hover:text-chalk"
    >
      Sign out
      <LogOut size={16} />
    </button>
  )
}
