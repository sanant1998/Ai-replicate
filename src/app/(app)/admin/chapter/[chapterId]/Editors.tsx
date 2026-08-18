'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { saveQuestion, saveTopic, type AdminState } from '../../actions'

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

export function TopicEditor({ chapterId, nextIndex }: { chapterId: string; nextIndex: number }) {
  const [state, action, pending] = useActionState(saveTopic, initial)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.saved) ref.current?.reset()
  }, [state.saved])

  return (
    <form ref={ref} action={action} className="rounded-3xl card-surface px-6 py-5">
      <input type="hidden" name="chapterId" value={chapterId} />
      <p className="text-sm font-extrabold tracking-wider text-navy/45">ADD A TOPIC</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[5rem_1fr_8rem_7rem]">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">No.</span>
          <input name="index" type="number" min={1} defaultValue={nextIndex} required className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Title</span>
          <input name="title" required placeholder="Introduction" className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Kind</span>
          <select name="kind" defaultValue="VIDEO" className={field}>
            <option value="VIDEO">Video</option>
            <option value="ACTIVITY">Activity</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Seconds</span>
          <input name="durationSec" type="number" min={0} defaultValue={0} className={field} />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-bold text-navy-deep">
          Video URL — HLS manifest or MP4 (leave blank while in production)
        </span>
        <input name="videoUrl" type="url" placeholder="https://cdn.example.com/lesson.m3u8" className={field} />
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-bold text-navy-deep">
          Poster image URL (optional) — shown before playback starts
        </span>
        <input name="posterUrl" type="url" placeholder="https://cdn.example.com/lesson.jpg" className={field} />
      </label>

      <Feedback state={state} noun="Topic" />

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-2xl flame-gradient px-5 py-2.5 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Add topic'}
      </button>
    </form>
  )
}

export function QuestionEditor({ chapterId, nextIndex }: { chapterId: string; nextIndex: number }) {
  const [state, action, pending] = useActionState(saveQuestion, initial)
  const [kind, setKind] = useState<'MCQ' | 'NUMERIC' | 'SHORT'>('MCQ')
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.saved) ref.current?.reset()
  }, [state.saved])

  return (
    <form ref={ref} action={action} className="rounded-3xl card-surface px-6 py-5">
      <input type="hidden" name="chapterId" value={chapterId} />
      <p className="text-sm font-extrabold tracking-wider text-navy/45">ADD A QUESTION</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[5rem_1fr_8rem_6rem]">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">No.</span>
          <input name="index" type="number" min={1} defaultValue={nextIndex} required className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Type</span>
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className={field}
          >
            <option value="MCQ">Multiple choice</option>
            <option value="NUMERIC">Numeric answer</option>
            <option value="SHORT">Short answer</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Difficulty</span>
          <select name="difficulty" defaultValue="1" className={field}>
            <option value="1">Easy</option>
            <option value="2">Medium</option>
            <option value="3">Hard</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Marks</span>
          <input name="marks" type="number" min={1} defaultValue={1} className={field} />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-bold text-navy-deep">Question</span>
        <textarea name="prompt" rows={2} required className={`${field} resize-y`} />
      </label>

      {kind === 'MCQ' && (
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Options — one per line</span>
          <textarea name="options" rows={4} className={`${field} resize-y`} />
        </label>
      )}

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-bold text-navy-deep">
          {kind === 'MCQ'
            ? 'Correct answer — the option number, counting from 0'
            : 'Correct answer'}
        </span>
        <input
          name="answer"
          required
          placeholder={kind === 'MCQ' ? '0' : kind === 'NUMERIC' ? '13' : 'winnowing'}
          className={field}
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-bold text-navy-deep">
          Explanation, shown after marking (optional)
        </span>
        <textarea name="explanation" rows={2} className={`${field} resize-y`} />
      </label>

      <Feedback state={state} noun="Question" />

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-2xl flame-gradient px-5 py-2.5 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Add question'}
      </button>
    </form>
  )
}
