'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { login, signup, type AuthState } from './actions'

const initial: AuthState = {}

export type BoardOption = {
  id: string
  code: string
  name: string
  classes: { id: string; label: string }[]
}

export function AuthForm({
  mode,
  boards = [],
  next,
  onSwitchMode,
  compact,
}: {
  mode: 'login' | 'signup'
  boards?: BoardOption[]
  /** Where to send the user once they're in — e.g. the checkout they clicked. */
  next?: string
  /** Supplied on the landing page, where switching is a toggle, not a navigation. */
  onSwitchMode?: (next: 'login' | 'signup') => void
  /** Drops the outer card so the form can sit inside one the caller already drew. */
  compact?: boolean
}) {
  const action = mode === 'signup' ? signup : login
  const [state, formAction, pending] = useActionState(action, initial)
  const [boardId, setBoardId] = useState(boards[0]?.id ?? '')

  const classes = boards.find((b) => b.id === boardId)?.classes ?? []

  const Heading = compact ? 'h2' : 'h1'

  return (
    <div className={compact ? '' : 'rounded-3xl card-surface p-6'}>
      {onSwitchMode && (
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-navy/8 p-1">
          {(['signup', 'login'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onSwitchMode(m)}
              aria-pressed={mode === m}
              className={
                mode === m
                  ? 'rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-navy-deep shadow-sm'
                  : 'rounded-xl px-3 py-2 text-sm font-bold text-navy/50 transition hover:text-navy-deep'
              }
            >
              {m === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          ))}
        </div>
      )}

      <Heading className="text-xl font-extrabold text-navy-deep">
        {mode === 'signup' ? 'Create your account' : 'Welcome back'}
      </Heading>
      <p className="mt-1 mb-5 text-sm font-semibold text-navy/50">
        {mode === 'signup'
          ? 'Chapter 1 of every subject is free, forever.'
          : 'Sign in to pick up where you left off.'}
      </p>

      <form action={formAction} className="space-y-3">
        {next && <input type="hidden" name="next" value={next} />}
        {mode === 'signup' && <Field name="name" label="Name" type="text" autoComplete="name" />}
        <Field name="email" label="Email" type="email" autoComplete="email" />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />

        {mode === 'signup' && boards.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-navy-deep">Board</span>
              <select
                name="boardId"
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-navy-deep">Class</span>
              <select
                name="classLevelId"
                key={boardId} /* reset the selection when the board changes */
                className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {mode === 'signup' && (
          <label className="flex items-start gap-2.5 rounded-xl bg-navy/5 px-3 py-2.5">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-ember,#EA580C)]"
            />
            <span className="text-[13px] font-semibold leading-snug text-navy/65">
              I have my parent or guardian&apos;s permission to use PaperPath, and I accept the{' '}
              <Link href="/terms" className="font-bold text-ember hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="font-bold text-ember hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        )}

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
          {pending ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      {/* On the landing page the tabs above already switch mode, so only the
          password-reset escape hatch is worth repeating here. */}
      <p className="mt-4 text-center text-sm font-semibold text-navy/50">
        {onSwitchMode ? (
          mode === 'login' && (
            <Link href="/forgot-password" className="text-navy/45 hover:underline">
              Forgot your password?
            </Link>
          )
        ) : mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <Link
              href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
              className="font-bold text-ember hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link
              href={
                next
                  ? `/login?mode=signup&next=${encodeURIComponent(next)}`
                  : '/login?mode=signup'
              }
              className="font-bold text-ember hover:underline"
            >
              Create an account
            </Link>
            <br />
            <Link href="/forgot-password" className="text-navy/45 hover:underline">
              Forgot your password?
            </Link>
          </>
        )}
      </p>

    </div>
  )
}

function Field({
  name,
  label,
  type,
  autoComplete,
}: {
  name: string
  label: string
  type: string
  autoComplete: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-navy-deep">{label}</span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
      />
    </label>
  )
}
