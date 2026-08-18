'use client'

import { useActionState, useEffect, useRef } from 'react'
import { saveTopicAnswer, saveTopicMaterial, type AdminState } from '../../actions'

const initial: AdminState = {}

const field =
  'w-full rounded-xl border border-navy/15 bg-surface px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber'

function Feedback({ state, noun }: { state: AdminState; noun: string }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="mt-3 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className="mt-3 rounded-xl bg-moss/10 px-3 py-2 text-sm font-semibold text-moss">
          {noun} saved.
        </p>
      )}
    </>
  )
}

/**
 * The material box.
 *
 * Not reset after saving, unlike the add-forms elsewhere in the panel: this one
 * edits a value that already exists, and blanking the textarea on success would
 * look exactly like having deleted the thing that was just saved.
 */
export function MaterialEditor({ topicId, content }: { topicId: string; content: string }) {
  const [state, action, pending] = useActionState(saveTopicMaterial, initial)

  return (
    <form action={action} className="rounded-3xl card-surface px-6 py-5">
      <input type="hidden" name="topicId" value={topicId} />
      <p className="text-sm font-extrabold tracking-wider text-navy/45">TOPIC MATERIAL</p>
      <p className="mt-1 text-sm font-semibold text-navy/45">
        Everything the guided tutor is allowed to say about this topic. Paste the notes,
        definitions, formulae and worked examples. Anything not in here, it will refuse to answer.
        Leave it empty to take the topic off Guided Practice.
      </p>

      <textarea
        name="content"
        rows={14}
        defaultValue={content}
        placeholder="Paste the topic notes here…"
        className={`${field} mt-3 resize-y font-medium`}
      />

      <Feedback state={state} noun="Material" />

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-2xl flame-gradient px-5 py-2.5 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save material'}
      </button>
    </form>
  )
}

export function AnswerEditor({ topicId, nextIndex }: { topicId: string; nextIndex: number }) {
  const [state, action, pending] = useActionState(saveTopicAnswer, initial)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.saved) ref.current?.reset()
  }, [state.saved])

  return (
    <form ref={ref} action={action} className="rounded-3xl card-surface px-6 py-5">
      <input type="hidden" name="topicId" value={topicId} />
      <p className="text-sm font-extrabold tracking-wider text-navy/45">ADD AN EXACT ANSWER</p>
      <p className="mt-1 text-sm font-semibold text-navy/45">
        When a student asks this question — in any wording — they are shown this answer word for
        word. The tutor only writes the explanation around it.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[5rem_1fr]">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">No.</span>
          <input name="index" type="number" min={1} defaultValue={nextIndex} required className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Question</span>
          <input name="question" required placeholder="What is 2 × 8?" className={field} />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-bold text-navy-deep">
          The answer, exactly as the student should read it
        </span>
        <textarea name="answer" rows={2} required placeholder="16" className={`${field} resize-y`} />
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-bold text-navy-deep">
          Steps — one per line (optional; leave empty and the tutor writes them)
        </span>
        <textarea
          name="steps"
          rows={4}
          placeholder={'2 × 8 means adding 8 two times.\n8 + 8 = 16.'}
          className={`${field} resize-y`}
        />
      </label>

      <Feedback state={state} noun="Answer" />

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-2xl flame-gradient px-5 py-2.5 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Add answer'}
      </button>
    </form>
  )
}
