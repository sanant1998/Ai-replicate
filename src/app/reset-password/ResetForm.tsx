'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { completeReset, type ResetState } from '../forgot-password/actions'

const initial: ResetState = {}

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(completeReset, initial)

  return (
    <div className="rounded-3xl card-surface p-6">
      <h1 className="text-xl font-extrabold text-navy-deep">Choose a new password</h1>
      <p className="mt-1 mb-5 text-sm font-semibold text-navy/50">At least 8 characters.</p>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="token" value={token} />

        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">New password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Confirm password</span>
          <input
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
          />
        </label>

        {state.error && (
          <p role="alert" className="rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-2xl flame-gradient px-4 py-3 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Set new password'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm font-semibold text-navy/50">
        <Link href="/forgot-password" className="font-bold text-ember hover:underline">
          Request a new link
        </Link>
      </p>
    </div>
  )
}
