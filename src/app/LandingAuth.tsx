'use client'

import { useState } from 'react'
import { AuthForm, type BoardOption } from '@/app/login/AuthForm'

/**
 * The landing page's sign-in / sign-up panel. Same server actions as /login —
 * this only swaps navigation for a local toggle so a visitor never leaves the
 * page to create an account.
 */
export function LandingAuth({
  boards,
  defaultMode = 'signup',
}: {
  boards: BoardOption[]
  defaultMode?: 'login' | 'signup'
}) {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode)

  return (
    <div id="join" className="rounded-3xl card-surface p-6 shadow-xl shadow-navy/10">
      {/* Keyed by mode so switching tabs remounts the form. Without it the
          toggle only changes a prop, and useActionState keeps the state from
          the previous submission — so a failed sign-in leaves "Email or
          password is incorrect" sitting above an empty Create account form. */}
      <AuthForm key={mode} mode={mode} boards={boards} onSwitchMode={setMode} compact />
    </div>
  )
}
