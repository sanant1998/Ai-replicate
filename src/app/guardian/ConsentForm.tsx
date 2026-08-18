'use client'

import { useActionState, useState } from 'react'
import { giveConsent, type GuardianState } from './actions'

const inputClass =
  'mt-1 block min-h-11 w-full rounded-xl border border-navy/15 bg-surface px-3 font-semibold text-navy-deep outline-none transition focus:border-amber'

export function ConsentForm({ token, guardianEmail }: { token: string; guardianEmail: string | null }) {
  const [state, action, pending] = useActionState<GuardianState, FormData>(giveConsent, {})
  const [createAccount, setCreateAccount] = useState(false)

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />

      {guardianEmail && (
        <label className="flex items-start gap-2.5 rounded-xl bg-navy/5 px-3 py-3">
          <input
            type="checkbox"
            name="createAccount"
            checked={createAccount}
            onChange={(e) => setCreateAccount(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-ember,#EA580C)]"
          />
          <span className="text-sm font-semibold leading-snug text-navy/70">
            Also give me an account on <strong>{guardianEmail}</strong> so I can see what they have
            watched and how their quizzes are going. It is read-only — I cannot take their quizzes
            or read their tutor conversations.
          </span>
        </label>
      )}

      {createAccount && (
        <div className="space-y-3 rounded-xl border border-navy/12 px-4 py-4">
          <label className="block">
            <span className="text-sm font-bold text-navy/60">Your name</span>
            <input name="name" required minLength={2} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-navy/60">Choose a password</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={inputClass}
            />
          </label>
        </div>
      )}

      {state.error && (
        <p role="alert" className="rounded-xl bg-ember/10 px-4 py-3 font-semibold text-ember">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-2xl flame-gradient px-6 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'I give my permission'}
      </button>
    </form>
  )
}
