'use client'

import { useActionState, useState, type ReactNode } from 'react'
import {
  explainDoubt,
  generateFormulaSheet,
  generatePractice,
  type PracticeQuestion,
  type ToolState,
} from './actions'

export type ChapterOption = { id: string; label: string }

const textInitial: ToolState<string> = {}
const listInitial: ToolState<PracticeQuestion[]> = {}

function ChapterSelect({ chapters }: { chapters: ChapterOption[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-navy-deep">Chapter</span>
      <select
        name="chapterId"
        required
        className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
      >
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Shell({
  title,
  blurb,
  children,
}: {
  title: string
  blurb: string
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl card-surface px-6 py-5">
      <h2 className="font-extrabold text-navy-deep">{title}</h2>
      <p className="mt-1 text-sm font-semibold text-navy/50">{blurb}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Submit({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-2xl flame-gradient px-5 py-2.5 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
    >
      {pending ? busy : idle}
    </button>
  )
}

function Error({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-3 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
      {message}
    </p>
  )
}

/**
 * The model returns Markdown. Rendering it as rich HTML would mean trusting
 * model output as markup, so it is shown as pre-wrapped text instead — readable,
 * and impossible to turn into an injection.
 */
function Output({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-2xl bg-navy/4 px-4 py-3">
      <pre className="scroll-slim max-h-[28rem] overflow-auto whitespace-pre-wrap font-sans text-sm font-semibold leading-relaxed text-navy-deep">
        {text}
      </pre>
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(text)}
        className="mt-2 rounded-lg border border-navy/15 bg-white px-3 py-1 text-xs font-bold text-navy/60 transition hover:border-amber"
      >
        Copy
      </button>
    </div>
  )
}

export function FormulaSheetTool({ chapters }: { chapters: ChapterOption[] }) {
  const [state, action, pending] = useActionState(generateFormulaSheet, textInitial)
  return (
    <Shell
      title="Formula sheet"
      blurb="Every formula and standard result in the chapter, on one page you can print."
    >
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <ChapterSelect chapters={chapters} />
        </div>
        <Submit pending={pending} idle="Generate sheet" busy="Writing…" />
      </form>
      <Error message={state.error} />
      {state.result && <Output text={state.result} />}
    </Shell>
  )
}

export function PracticeTool({ chapters }: { chapters: ChapterOption[] }) {
  const [state, action, pending] = useActionState(generatePractice, listInitial)
  const [shown, setShown] = useState<Record<number, boolean>>({})

  return (
    <Shell
      title="Practice generator"
      blurb="Five fresh questions at the difficulty you pick, with full working hidden until you ask."
    >
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <ChapterSelect chapters={chapters} />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Difficulty</span>
          <select
            name="level"
            defaultValue="medium"
            className="rounded-xl border border-navy/15 bg-white px-3 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <Submit pending={pending} idle="Generate questions" busy="Writing…" />
      </form>
      <Error message={state.error} />

      {state.result && (
        <ol className="mt-4 space-y-2">
          {state.result.map((q, i) => (
            <li key={i} className="rounded-2xl bg-navy/4 px-4 py-3">
              <p className="font-bold text-navy-deep">
                {i + 1}. {q.question}
              </p>
              {shown[i] ? (
                <div className="mt-2 space-y-1.5 border-t border-navy/10 pt-2">
                  <p className="whitespace-pre-wrap text-sm font-semibold text-navy/70">{q.working}</p>
                  <p className="text-sm font-extrabold text-moss">Answer: {q.answer}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShown((s) => ({ ...s, [i]: true }))}
                  className="mt-2 rounded-lg border border-navy/15 bg-white px-3 py-1 text-xs font-bold text-navy/60 transition hover:border-amber"
                >
                  Show working
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Shell>
  )
}

export function DoubtTool({ chapters }: { chapters: ChapterOption[] }) {
  const [state, action, pending] = useActionState(explainDoubt, textInitial)
  return (
    <Shell
      title="Doubt solver"
      blurb="Paste the question you are stuck on and get it broken down step by step."
    >
      <form action={action} className="space-y-3">
        <ChapterSelect chapters={chapters} />
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-navy-deep">Your question</span>
          <textarea
            name="question"
            rows={3}
            required
            placeholder="Type or paste the question exactly as it appears."
            className="scroll-slim w-full resize-y rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber"
          />
        </label>
        <Submit pending={pending} idle="Explain it" busy="Thinking…" />
      </form>
      <Error message={state.error} />
      {state.result && <Output text={state.result} />}
    </Shell>
  )
}
