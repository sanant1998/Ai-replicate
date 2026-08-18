'use client'

import { useActionState } from 'react'
import { updateLanguage, type ProfileState } from './actions'
import { LANGUAGES } from '@/lib/language'

const initial: ProfileState = {}

/**
 * Deliberately honest about its own scope: this changes what the AI tutor
 * answers in, not what the buttons say. Promising "the app in Hindi" and then
 * showing an English sidebar is worse than saying plainly which half is
 * translated.
 */
export function LanguageSettings({ current }: { current: string }) {
  const [state, formAction, pending] = useActionState(updateLanguage, initial)

  return (
    <form action={formAction} className="rounded-3xl card-surface px-6 py-5">
      <p className="text-sm font-extrabold tracking-wider text-navy/45">TUTOR LANGUAGE</p>
      <p className="mt-1 text-sm font-semibold text-navy/50">
        The language the AI tutor and the practice generator answer in. Subject terms and formulae
        stay in English, because those are the words you write in your exam. The rest of the app is
        in English for now.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Language</span>
          <select
            name="language"
            defaultValue={current}
            className="w-full rounded-xl border border-navy/15 bg-surface px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
          >
            {LANGUAGES.map((l) => (
              <option key={l.tag} value={l.tag}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-2xl flame-gradient px-5 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className="mt-3 rounded-xl bg-moss/10 px-3 py-2 text-sm font-semibold text-moss">
          Saved. Ask the tutor something to hear it.
        </p>
      )}
    </form>
  )
}
