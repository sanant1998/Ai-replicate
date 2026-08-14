'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { addNote, deleteNote, type NoteState } from '@/app/(app)/study-actions'
import { formatClock } from '@/lib/format'

const initial: NoteState = {}

export type NoteRow = { id: string; body: string; atSec: number; createdAt: string }

/**
 * Notes are timestamped against the video. The position is read from the
 * <video> element at the moment you start typing, so a note lands where you
 * were watching rather than where you happen to be when you hit save.
 */
export function NotesPanel({ topicId, notes }: { topicId: string; notes: NoteRow[] }) {
  const [state, formAction, pending] = useActionState(addNote, initial)
  const [atSec, setAtSec] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.saved) formRef.current?.reset()
  }, [state.saved])

  const stamp = () => {
    const v = document.querySelector('video')
    setAtSec(Math.floor(v?.currentTime ?? 0))
  }

  return (
    <section className="rounded-3xl card-surface px-6 py-5">
      <h2 className="text-sm font-extrabold tracking-wider text-navy/45">MY NOTES</h2>

      <form ref={formRef} action={formAction} className="mt-3">
        <input type="hidden" name="topicId" value={topicId} />
        <input type="hidden" name="atSec" value={atSec} />
        <textarea
          name="body"
          rows={2}
          onFocus={stamp}
          placeholder="Jot something down — it gets stamped with the video time."
          className="scroll-slim max-h-40 w-full resize-y rounded-2xl border border-navy/15 bg-white px-3.5 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-navy/40">
            {atSec > 0 ? `Will be saved at ${formatClock(atSec)}` : 'Start typing to stamp the time'}
          </span>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white transition hover:bg-navy-deep disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </form>

      {state.error && (
        <p role="alert" className="mt-2 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
          {state.error}
        </p>
      )}

      {notes.length > 0 && (
        <ul className="mt-4 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-2xl bg-navy/4 px-3.5 py-2.5">
              <button
                type="button"
                onClick={() => {
                  const v = document.querySelector('video')
                  if (v) {
                    v.currentTime = n.atSec
                    void v.play()
                  }
                }}
                className="mt-0.5 shrink-0 rounded-lg bg-navy/10 px-2 py-0.5 text-xs font-extrabold text-navy/60 transition hover:bg-amber hover:text-white"
                aria-label={`Jump to ${formatClock(n.atSec)}`}
              >
                {formatClock(n.atSec)}
              </button>
              <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm font-semibold text-navy-deep">
                {n.body}
              </p>
              <form action={deleteNote}>
                <input type="hidden" name="id" value={n.id} />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg px-1.5 text-navy/30 transition hover:text-ember"
                  aria-label="Delete note"
                >
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
