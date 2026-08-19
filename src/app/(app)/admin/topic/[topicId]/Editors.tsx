'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import {
  saveTopicAnswer,
  saveTopicMaterial,
  suggestTopicNames,
  type AdminState,
} from '../../actions'

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
 * The material box, and the two names that come out of it.
 *
 * Not reset after saving, unlike the add-forms elsewhere in the panel: this one
 * edits a value that already exists, and blanking the textarea on success would
 * look exactly like having deleted the thing that was just saved.
 *
 * The names are filled in by reading what was pasted, because that is the order
 * the work actually happens in — somebody arrives with a page of notes in the
 * clipboard, not with an opinion about what the topic is called. They are plain
 * text fields all the same: type over either one and the suggestion stops
 * touching it, so the model gets the first draft and the person gets the last
 * word. The button re-reads the material and overwrites both, which is how you
 * take that back.
 */
export function MaterialEditor({
  topicId,
  content,
  topicTitle,
  chapterTitle,
  chapterIndex,
}: {
  topicId: string
  content: string
  topicTitle: string
  chapterTitle: string
  chapterIndex: number
}) {
  const [state, action, pending] = useActionState(saveTopicMaterial, initial)
  const box = useRef<HTMLTextAreaElement>(null)
  const [names, setNames] = useState({ topic: topicTitle, chapter: chapterTitle })
  const [naming, startNaming] = useTransition()
  const [namingError, setNamingError] = useState<string | null>(null)

  // Which fields the person has typed in, and the material the current names
  // were read from. Between them these stop the two things that would make the
  // automatic naming annoying: overwriting a name somebody just typed, and
  // spending a model call on every blur when nothing has changed.
  const edited = useRef({ topic: false, chapter: false })
  const namedFrom = useRef(content.trim())

  function runNaming(force: boolean) {
    const text = box.current?.value.trim() ?? ''
    if (!force) {
      if (text.length < 120 || text === namedFrom.current) return
    }
    namedFrom.current = text
    setNamingError(null)
    startNaming(async () => {
      const result = await suggestTopicNames(topicId, text)
      if (result.error || !result.topicTitle || !result.chapterTitle) {
        setNamingError(result.error ?? 'Could not name that one. Type the names in.')
        return
      }
      setNames((prev) => ({
        topic: force || !edited.current.topic ? result.topicTitle! : prev.topic,
        chapter: force || !edited.current.chapter ? result.chapterTitle! : prev.chapter,
      }))
      if (force) edited.current = { topic: false, chapter: false }
    })
  }

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
        ref={box}
        name="content"
        rows={14}
        defaultValue={content}
        // Paste first, then blur, because either one can be the moment the
        // material lands: pasting is the common route, typing or dropping text
        // in is not. Both go through the same guard, so whichever fires second
        // on the same text does nothing.
        onPaste={() => setTimeout(() => runNaming(false), 0)}
        onBlur={() => runNaming(false)}
        placeholder="Paste the topic notes here…"
        className={`${field} mt-3 resize-y font-medium`}
      />

      <div className="mt-4 rounded-2xl border border-navy/10 bg-navy/[0.03] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-extrabold tracking-wider text-navy/45">
            NAMES {naming && <span className="text-amber">· reading the material…</span>}
          </p>
          <button
            type="button"
            onClick={() => runNaming(true)}
            disabled={naming}
            className="rounded-xl border border-navy/15 px-3 py-1.5 text-sm font-bold text-navy/60 transition hover:border-amber hover:text-amber disabled:opacity-60"
          >
            {naming ? 'Naming…' : 'Name from the content'}
          </button>
        </div>
        <p className="mt-1 text-sm font-semibold text-navy/45">
          Written from what you paste, and yours to overwrite. Saved with the material.
        </p>

        <label className="mt-3 block text-sm font-bold text-navy/60" htmlFor="topic-title">
          Topic name
        </label>
        <input
          id="topic-title"
          name="title"
          value={names.topic}
          onChange={(e) => {
            edited.current.topic = true
            setNames((prev) => ({ ...prev, topic: e.target.value }))
          }}
          className={`${field} mt-1`}
        />

        <label className="mt-3 block text-sm font-bold text-navy/60" htmlFor="chapter-title">
          Chapter name
        </label>
        <input
          id="chapter-title"
          name="chapterTitle"
          value={names.chapter}
          onChange={(e) => {
            edited.current.chapter = true
            setNames((prev) => ({ ...prev, chapter: e.target.value }))
          }}
          className={`${field} mt-1`}
        />
        <p className="mt-1 text-sm font-semibold text-navy/45">
          Chapter {chapterIndex} is shared — renaming it here renames it for every topic under it.
        </p>

        {namingError && (
          <p role="status" className="mt-3 text-sm font-semibold text-amber">
            {namingError}
          </p>
        )}
      </div>

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
