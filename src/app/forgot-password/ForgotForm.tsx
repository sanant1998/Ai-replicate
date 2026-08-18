'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestReset, type ResetState } from './actions'

const initial: ResetState = {}

export function ForgotForm() {
  const [state, formAction, pending] = useActionState(requestReset, initial)

  if (state.sent) {
    return (
      <div className="rounded-3xl card-surface p-6 text-center">
        <h1 className="text-xl font-extrabold text-navy-deep">Check your email</h1>
        <p className="mt-2 text-sm font-semibold text-navy/55">
          If that address has an account, a reset link is on its way. It expires in an hour.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-2xl flame-gradient px-6 py-2.5 font-extrabold text-white shadow-lg shadow-ember/25"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-3xl card-surface p-6">
      <h1 className="text-xl font-extrabold text-navy-deep">Reset your password</h1>
      <p className="mt-1 mb-5 text-sm font-semibold text-navy/50">
        We&apos;ll email you a link to choose a new one.
      </p>

      <form action={formAction} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-navy/15 bg-surface px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
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
          {pending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm font-semibold text-navy/50">
        <Link href="/login" className="font-bold text-ember hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
