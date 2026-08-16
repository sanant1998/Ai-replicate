'use client'

import { useActionState } from 'react'
import clsx from 'clsx'
import { startAttempt, submitAttempt, type QuizState } from './actions'

const initial: QuizState = {}

export type QuizQuestion = {
  id: string
  index: number
  kind: 'MCQ' | 'NUMERIC' | 'SHORT'
  prompt: string
  options: string[]
  marks: number
}

export function QuizRunner({
  chapterId,
  attemptId,
  questions,
  hasQuestions,
}: {
  chapterId: string
  attemptId?: string
  questions: QuizQuestion[]
  hasQuestions: boolean
}) {
  const [startState, startAction, starting] = useActionState(startAttempt, initial)
  const [submitState, submitAction, submitting] = useActionState(submitAttempt, initial)

  const liveAttempt = attemptId ?? startState.attemptId

  if (!hasQuestions) {
    return (
      <div className="rounded-3xl card-surface px-8 py-10 text-center">
        <h2 className="text-xl font-extrabold text-navy-deep">No questions yet</h2>
        <p className="mt-2 font-semibold text-navy/55">
          This chapter has no quiz written for it. Ask the AI tutor to quiz you on it instead, or
          generate a practice set from Tools.
        </p>
      </div>
    )
  }

  if (!liveAttempt) {
    const totalMarks = questions.reduce((n, q) => n + q.marks, 0)
    return (
      <form action={startAction} className="rounded-3xl card-surface px-8 py-10 text-center">
        <input type="hidden" name="chapterId" value={chapterId} />
        <h2 className="text-xl font-extrabold text-navy-deep">Chapter quiz</h2>
        <p className="mt-2 font-semibold text-navy/55">
          {questions.length} questions · {totalMarks} marks. There is no timer, and you can retake it
          as often as you like.
        </p>
        {startState.error && (
          <p role="alert" className="mt-3 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
            {startState.error}
          </p>
        )}
        <button
          type="submit"
          disabled={starting}
          className="mt-6 rounded-2xl flame-gradient px-7 py-3 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
        >
          {starting ? 'Starting…' : 'Start quiz'}
        </button>
      </form>
    )
  }

  return (
    <form action={submitAction} className="space-y-3">
      <input type="hidden" name="attemptId" value={liveAttempt} />

      {questions.map((q) => (
        <fieldset key={q.id} className="rounded-3xl card-surface px-6 py-5">
          <legend className="sr-only">Question {q.index}</legend>
          <p className="font-bold text-navy-deep">
            {q.index}. {q.prompt}
            {q.marks > 1 && (
              <span className="ml-2 text-xs font-extrabold text-navy/35">{q.marks} marks</span>
            )}
          </p>

          {q.kind === 'MCQ' ? (
            <div className="mt-3 grid gap-2">
              {/* Keyed by position, not text: two options that read the same
                  (a repeated "None of the above", a typo'd duplicate) would
                  otherwise collide and React would drop one. */}
              {q.options.map((opt, i) => (
                <label
                  key={`${q.id}-${i}`}
                  className={clsx(
                    'flex cursor-pointer items-start gap-2.5 rounded-xl border border-navy/12 px-3.5 py-2.5',
                    'font-semibold text-navy-deep transition hover:border-amber',
                    'has-[:checked]:border-amber has-[:checked]:bg-amber/10',
                  )}
                >
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    value={String(i)}
                    className="mt-1 size-4 shrink-0 accent-[#EA580C]"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <input
              name={`q_${q.id}`}
              type={q.kind === 'NUMERIC' ? 'text' : 'text'}
              inputMode={q.kind === 'NUMERIC' ? 'decimal' : 'text'}
              placeholder={q.kind === 'NUMERIC' ? 'Your answer, as a number' : 'Your answer'}
              className="mt-3 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
            />
          )}
        </fieldset>
      ))}

      {submitState.error && (
        <p role="alert" className="rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
          {submitState.error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl flame-gradient px-4 py-3.5 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
      >
        {submitting ? 'Marking…' : 'Submit answers'}
      </button>
      <p className="text-center text-xs font-semibold text-navy/40">
        Unanswered questions are marked wrong.
      </p>
    </form>
  )
}
