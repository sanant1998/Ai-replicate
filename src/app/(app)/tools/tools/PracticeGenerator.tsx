'use client'

import { useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { ShellCard, ShellPanel, ToolShell, type ShellTab } from '../ToolShell'

const icon = (path: string) => (
  <svg
    viewBox="0 0 24 24"
    className="size-[18px]"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={path} />
  </svg>
)

const IconPractice = (
  <svg
    viewBox="0 0 24 24"
    className="size-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 4h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z" />
    <path d="M9 12h6M9 16h4M12 4v4h4" />
  </svg>
)

const TABS: ShellTab[] = [
  { id: 'write', label: 'Practice', icon: icon('M12 5v14M5 12h14') },
  {
    id: 'about',
    label: 'About',
    icon: icon('M12 8h.01M11 12h1v4h1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'),
  },
]

export type Chapter = { id: string; label: string }

type Question = { question: string; answer: string; working: string }

const control =
  'w-full rounded-xl px-3 py-2.5 font-semibold outline-none transition focus:border-current'

/**
 * Generates practice questions for whatever the student is on.
 *
 * The catalog has 29 hand-written questions across 6 of its 44 chapters, so
 * "take the quiz" is unavailable for most of the syllabus. Those hand-written
 * ones stay the real assessment — marked server-side and scored into
 * Performance. These are practice: generated on demand, answers hidden until
 * asked for, never stored, and costing one of the day's tutor credits, because
 * they cost a model call exactly like a tutor message does.
 */
export function PracticeGenerator({
  onClose,
  chapters = [],
}: {
  onClose: () => void
  chapters?: Chapter[]
}) {
  const [tab, setTab] = useState('write')
  const [chapterId, setChapterId] = useState(chapters[0]?.id ?? '')
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subject, setSubject] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/practice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chapterId: chapterId || undefined,
          topic: topic.trim() || undefined,
          count,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.message ?? 'Could not write questions just now.')
        return
      }
      setSubject(body.subject ?? null)
      setQuestions(body.questions ?? [])
      setRevealed(new Set())
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (i: number) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const sidebar =
    tab === 'about' ? (
      <ShellCard title="About">
        <p className="text-sm font-semibold" style={{ color: 'var(--shell-muted)' }}>
          Questions are written fresh each time by the same model that powers the AI tutor, so each
          set costs one of your daily tutor credits. They are practice, not an exam: nothing here is
          marked or counted towards your performance. For that, use a chapter quiz.
        </p>
        <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--shell-muted)' }}>
          Check the working against your textbook. A model can be confidently wrong, and this one is
          not marking your board exam.
        </p>
      </ShellCard>
    ) : (
      <>
        {chapters.length > 0 && (
          <ShellCard title="Chapter">
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className={control}
              style={{
                background: 'var(--shell-panel)',
                border: '1px solid var(--shell-line)',
                color: 'var(--shell-text)',
              }}
            >
              <option value="">Something else…</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </ShellCard>
        )}

        {!chapterId && (
          <ShellCard title="What do you want to practise?">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Linear equations in one variable"
              className={control}
              style={{
                background: 'var(--shell-panel)',
                border: '1px solid var(--shell-line)',
                color: 'var(--shell-text)',
              }}
            />
          </ShellCard>
        )}

        <ShellCard title="How many">
          <div className="flex gap-2">
            {[3, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className="min-h-10 flex-1 rounded-xl text-sm font-extrabold transition"
                style={{
                  background: count === n ? 'var(--shell-active)' : 'var(--shell-panel)',
                  border: '1px solid var(--shell-line)',
                  color: 'var(--shell-text)',
                }}
              >
                {n} questions
              </button>
            ))}
          </div>
        </ShellCard>

        <ShellCard>
          <button
            type="button"
            onClick={generate}
            disabled={busy || (!chapterId && topic.trim().length < 3)}
            className="min-h-11 w-full rounded-xl flame-gradient font-extrabold text-white transition hover:brightness-105 disabled:opacity-50"
          >
            {busy ? 'Writing…' : 'Write me questions'}
          </button>
          <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--shell-muted)' }}>
            Uses one daily tutor credit.
          </p>
        </ShellCard>
      </>
    )

  return (
    <ToolShell
      title="Practice Generator"
      subtitle="Fresh questions on any chapter, with the working"
      icon={IconPractice}
      version="Practice Generator v1.0"
      status={busy ? 'Writing' : questions.length ? 'Ready' : 'Idle'}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      sidebar={sidebar}
      onClose={onClose}
    >
      <ShellPanel className="min-h-full">
        {error && (
          <p
            role="alert"
            className="mb-3 rounded-xl px-4 py-3 font-semibold"
            style={{ background: 'rgb(234 88 12 / 0.12)', color: '#ea580c' }}
          >
            {error}
          </p>
        )}

        {questions.length === 0 ? (
          <p className="py-16 text-center font-semibold" style={{ color: 'var(--shell-muted)' }}>
            {busy
              ? 'Writing your questions…'
              : 'Pick a chapter or type a topic, then press “Write me questions”.'}
          </p>
        ) : (
          <div className="space-y-3">
            {subject && (
              <p className="text-sm font-extrabold" style={{ color: 'var(--shell-muted)' }}>
                {subject}
              </p>
            )}
            {questions.map((q, i) => (
              <article
                key={i}
                className="rounded-2xl p-4"
                style={{ background: 'var(--shell-raise)', border: '1px solid var(--shell-line)' }}
              >
                <div className="flex gap-3">
                  <span
                    className="mt-0.5 size-6 shrink-0 rounded-full text-center text-sm font-extrabold leading-6"
                    style={{ background: 'var(--shell-active)', color: 'var(--shell-text)' }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1" style={{ color: 'var(--shell-text)' }}>
                    <Markdown>{q.question}</Markdown>

                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      aria-expanded={revealed.has(i)}
                      className="mt-3 text-sm font-extrabold text-ember hover:underline"
                    >
                      {revealed.has(i) ? 'Hide the answer' : 'Show the answer'}
                    </button>

                    {revealed.has(i) && (
                      <div
                        className="mt-2 rounded-xl px-3 py-2"
                        style={{ background: 'var(--shell-active)' }}
                      >
                        <Markdown>{q.answer}</Markdown>
                        {q.working && (
                          <div className="mt-2 text-sm" style={{ color: 'var(--shell-muted)' }}>
                            <Markdown>{q.working}</Markdown>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </ShellPanel>
    </ToolShell>
  )
}
