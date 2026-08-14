'use client'

import { useActionState, useEffect, useRef } from 'react'
import { saveChapter, type AdminState } from '../../actions'

const initial: AdminState = {}

export function ChapterEditor({ courseId, nextIndex }: { courseId: string; nextIndex: number }) {
  const [state, action, pending] = useActionState(saveChapter, initial)
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.saved) ref.current?.reset()
  }, [state.saved])

  return (
    <form ref={ref} action={action} className="rounded-3xl card-surface px-6 py-5">
      <input type="hidden" name="courseId" value={courseId} />
      <p className="text-sm font-extrabold tracking-wider text-navy/45">ADD A CHAPTER</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[5rem_1fr]">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">No.</span>
          <input
            name="index"
            type="number"
            min={1}
            defaultValue={nextIndex}
            required
            className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Title</span>
          <input
            name="title"
            required
            placeholder="Rational Numbers"
            className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-bold text-navy-deep">Summary (optional)</span>
        <textarea
          name="summary"
          rows={2}
          className="w-full resize-y rounded-xl border border-navy/15 bg-white px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
        />
      </label>

      <label className="mt-3 flex items-center gap-2">
        <input name="isFree" type="checkbox" className="size-4 accent-[#EA580C]" />
        <span className="text-sm font-bold text-navy-deep">Free for everyone (no subscription)</span>
      </label>

      {state.error && (
        <p role="alert" className="mt-3 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className="mt-3 rounded-xl bg-moss/10 px-3 py-2 text-sm font-semibold text-moss">Chapter saved.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-2xl flame-gradient px-5 py-2.5 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Add chapter'}
      </button>
    </form>
  )
}
