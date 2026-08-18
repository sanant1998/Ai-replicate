'use client'

import { useActionState, useState } from 'react'
import {
  changePassword,
  deleteAccount,
  signOutEverywhere,
  updateName,
  type AccountState,
  type DeleteState,
} from './account-actions'
import { requestGuardianConsent, resendVerification } from '@/app/login/actions'
import type { AuthState } from '@/app/login/actions'

const inputClass =
  'mt-1 block min-h-10 w-full max-w-xs rounded-xl border border-navy/15 bg-surface px-3 font-semibold text-navy-deep outline-none transition focus:border-amber'
const buttonClass =
  'min-h-10 rounded-xl border border-navy/15 bg-surface px-4 font-extrabold text-navy/65 transition hover:border-amber disabled:opacity-50'

function Result({ state }: { state: AccountState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-bold text-ember">
        {state.error}
      </p>
    )
  }
  if (state.saved) return <p className="text-sm font-bold text-moss">{state.saved}</p>
  return null
}

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
          className="mt-3 min-h-10 rounded-xl border border-navy/15 bg-surface px-4 font-extrabold text-navy/65 transition hover:border-amber disabled:opacity-50"
        >
          {pending ? 'Sending…' : 'Send a new link'}
        </button>
      </form>
    </div>
  )
}

/**
 * The parent/guardian half of consent.
 *
 * Signup only ever asked the student to tick a box saying they had permission,
 * which is a box the student ticks. This is where the guardian is actually
 * contacted — and where a mistyped address can be corrected, which otherwise
 * left a student permanently unable to get consent recorded.
 */
export function GuardianControls({
  guardianEmail,
  consentedAt,
}: {
  guardianEmail: string | null
  consentedAt: string | null
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestGuardianConsent, {})
  const [sent, setSent] = useState(false)

  if (consentedAt) {
    return (
      <div className="rounded-3xl border border-moss/30 bg-moss/5 px-6 py-5">
        <p className="font-extrabold text-navy-deep">Parent or guardian permission given</p>
        <p className="mt-1 text-sm font-semibold text-navy/60">
          Confirmed on {consentedAt}
          {guardianEmail ? ` by ${guardianEmail}` : ''}.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-navy/12 px-6 py-5">
      <p className="font-extrabold text-navy-deep">Parent or guardian permission</p>
      <p className="mt-1 text-sm font-semibold text-navy/60">
        {guardianEmail
          ? `We emailed ${guardianEmail} and are waiting for them to confirm. Wrong address? Change it below.`
          : 'Give us an address for your parent or guardian and we will ask them once. They can also choose to follow your progress.'}
      </p>
      <form action={action} onSubmit={() => setSent(true)} className="mt-3 space-y-2">
        <label className="block">
          <span className="sr-only">Parent or guardian email</span>
          <input
            name="guardianEmail"
            type="email"
            required
            defaultValue={guardianEmail ?? ''}
            placeholder="parent@example.com"
            className={inputClass}
          />
        </label>
        {state.error && (
          <p role="alert" className="text-sm font-bold text-ember">
            {state.error}
          </p>
        )}
        {sent && !state.error && !pending && (
          <p className="text-sm font-bold text-moss">Sent — ask them to check their inbox.</p>
        )}
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? 'Sending…' : guardianEmail ? 'Send again' : 'Send the request'}
        </button>
      </form>
    </div>
  )
}

/**
 * Name, password and "sign out everywhere" — the three things a signed-in
 * student could not previously change without either an email they may not
 * control or a database client.
 */
export function SecurityControls({ name }: { name: string }) {
  const [nameState, nameAction, namePending] = useActionState<AccountState, FormData>(updateName, {})
  const [pwState, pwAction, pwPending] = useActionState<AccountState, FormData>(changePassword, {})
  const [revokeState, revokeAction, revokePending] = useActionState<AccountState, FormData>(
    signOutEverywhere,
    {},
  )

  return (
    <div className="space-y-5 rounded-3xl border border-navy/12 px-6 py-5">
      <div>
        <p className="font-extrabold text-navy-deep">Your name</p>
        <form action={nameAction} className="mt-2 space-y-2">
          <label className="block">
            <span className="sr-only">Name</span>
            <input name="name" defaultValue={name} required className={inputClass} />
          </label>
          <Result state={nameState} />
          <button type="submit" disabled={namePending} className={buttonClass}>
            {namePending ? 'Saving…' : 'Save name'}
          </button>
        </form>
      </div>

      <hr className="border-navy/8" />

      <div>
        <p className="font-extrabold text-navy-deep">Change your password</p>
        <p className="mt-1 text-sm font-semibold text-navy/55">
          Changing it signs you out on every other device. You stay signed in here.
        </p>
        <form action={pwAction} className="mt-2 space-y-2">
          <label className="block">
            <span className="text-sm font-bold text-navy/60">Current password</span>
            <input
              name="current"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-navy/60">New password</span>
            <input
              name="next"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-navy/60">New password again</span>
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className={inputClass}
            />
          </label>
          <Result state={pwState} />
          <button type="submit" disabled={pwPending} className={buttonClass}>
            {pwPending ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </div>

      <hr className="border-navy/8" />

      <div>
        <p className="font-extrabold text-navy-deep">Signed in somewhere else?</p>
        <p className="mt-1 text-sm font-semibold text-navy/55">
          Ends every other session — a school computer, a friend&rsquo;s phone — without changing
          your password.
        </p>
        <form action={revokeAction} className="mt-2 space-y-2">
          <Result state={revokeState} />
          <button type="submit" disabled={revokePending} className={buttonClass}>
            {revokePending ? 'Signing out…' : 'Sign out everywhere else'}
          </button>
        </form>
      </div>
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
          className="mt-3 inline-block min-h-10 rounded-xl border border-navy/15 bg-surface px-4 py-2.5 font-extrabold text-navy/65 transition hover:border-amber"
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
            className="mt-3 min-h-10 rounded-xl border border-ember/40 bg-surface px-4 font-extrabold text-ember transition hover:bg-ember hover:text-white"
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
                className="mt-1 block min-h-10 w-full max-w-xs rounded-xl border border-navy/15 bg-surface px-3 font-semibold text-navy-deep outline-none transition focus:border-amber"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-navy/60">
                Type <span className="font-mono">DELETE</span> to confirm
              </span>
              <input
                name="confirm"
                required
                className="mt-1 block min-h-10 w-full max-w-xs rounded-xl border border-navy/15 bg-surface px-3 font-semibold text-navy-deep outline-none transition focus:border-amber"
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
                className="min-h-10 rounded-xl border border-navy/15 bg-surface px-4 font-extrabold text-navy/65 transition hover:border-amber"
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
