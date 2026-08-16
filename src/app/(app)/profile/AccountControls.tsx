'use client'

import { useActionState, useState } from 'react'
import { deleteAccount, type DeleteState } from './account-actions'
import { resendVerification } from '@/app/login/actions'
import type { AuthState } from '@/app/login/actions'

/**
 * Confirmation banner for an unverified address. Shown rather than enforced:
 * the account works either way, on the reduced tutor allowance.
 */
export function VerifyEmailNotice({ email }: { email: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resendVerification, {})
  const [sent, setSent] = useState(false)

  return (
    <div className="rounded-3xl border border-amber/40 bg-amber/8 px-6 py-5">
      <p className="font-extrabold text-navy-deep">Confirm your email</p>
      <p className="mt-1 text-sm font-semibold text-navy/60">
        We sent a link to {email}. Until it is confirmed your account is limited to 2 AI tutor
        questions a day instead of your full allowance.
      </p>
      {state.error && <p className="mt-2 text-sm font-bold text-ember">{state.error}</p>}
      {sent && !state.error && !pending && (
        <p className="mt-2 text-sm font-bold text-navy/60">Sent — check your inbox and spam folder.</p>
      )}
      <form action={action} onSubmit={() => setSent(true)}>
        <button
          type="submit"
          disabled={pending}
          className="mt-3 min-h-10 rounded-xl border border-navy/15 bg-white px-4 font-extrabold text-navy/65 transition hover:border-amber disabled:opacity-50"
        >
          {pending ? 'Sending…' : 'Send a new link'}
        </button>
      </form>
    </div>
  )
}

/** Data export and account erasure, kept together at the bottom of the page. */
export function AccountControls() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {})
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-4 rounded-3xl border border-navy/12 px-6 py-5">
      <div>
        <p className="font-extrabold text-navy-deep">Your data</p>
        <p className="mt-1 text-sm font-semibold text-navy/55">
          Download everything this account holds — progress, notes, quiz attempts, tutor
          conversations and payments — as a single JSON file.
        </p>
        {/* A plain link, not fetch(): the browser handles Content-Disposition
            itself, and this keeps working with JavaScript disabled. */}
        <a
          href="/api/account/export"
          className="mt-3 inline-block min-h-10 rounded-xl border border-navy/15 bg-white px-4 py-2.5 font-extrabold text-navy/65 transition hover:border-amber"
        >
          Download my data
        </a>
      </div>

      <hr className="border-navy/8" />

      <div>
        <p className="font-extrabold text-ember">Delete this account</p>
        <p className="mt-1 text-sm font-semibold text-navy/55">
          Permanent. Your progress, notes, quiz history and tutor conversations are erased, and any
          remaining subscription is lost without a refund.
        </p>

        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 min-h-10 rounded-xl border border-ember/40 bg-white px-4 font-extrabold text-ember transition hover:bg-ember hover:text-white"
          >
            Delete account
          </button>
        ) : (
          <form action={action} className="mt-3 space-y-3">
            <label className="block">
              <span className="text-sm font-bold text-navy/60">Your password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block min-h-10 w-full max-w-xs rounded-xl border border-navy/15 bg-white px-3 font-semibold text-navy-deep outline-none transition focus:border-amber"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-navy/60">
                Type <span className="font-mono">DELETE</span> to confirm
              </span>
              <input
                name="confirm"
                required
                className="mt-1 block min-h-10 w-full max-w-xs rounded-xl border border-navy/15 bg-white px-3 font-semibold text-navy-deep outline-none transition focus:border-amber"
              />
            </label>

            {state.error && <p className="text-sm font-bold text-ember">{state.error}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="min-h-10 rounded-xl bg-ember px-4 font-extrabold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {pending ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-10 rounded-xl border border-navy/15 bg-white px-4 font-extrabold text-navy/65 transition hover:border-amber"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
