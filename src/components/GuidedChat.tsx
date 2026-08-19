'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { IconCheck, IconRobot, IconSend } from '@/components/icons'
import { Markdown } from '@/components/Markdown'
import { clearGuidedChat } from '@/app/(app)/guided/actions'

export type GuidedTurn = {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  steps: string[]
}

type Props = {
  topicId: string
  topicLabel: string
  initialSessionId?: string
  initialMessages: GuidedTurn[]
  suggestions: string[]
  /** Null for accounts that are not charged — test accounts. */
  credits: number | null
}

/**
 * How many steps of a past answer are open.
 *
 * Answers loaded from a previous visit start fully open: the gate is there to
 * pace a student through an explanation they are reading now, and re-gating
 * something they already worked through would be a chore, not a lesson.
 */
type Revealed = Record<string, number>

export function GuidedChat({
  topicId,
  topicLabel,
  initialSessionId,
  initialMessages,
  suggestions,
  credits,
}: Props) {
  const [turns, setTurns] = useState<GuidedTurn[]>(initialMessages)
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [left, setLeft] = useState(credits)
  const [gated, setGated] = useState(true)
  const [revealed, setRevealed] = useState<Revealed>(() =>
    Object.fromEntries(initialMessages.map((m) => [m.id, m.steps.length])),
  )
  // Two-step, because clearing cannot be undone. A bare button next to "Ask"
  // is one misclick away from deleting the working somebody is reading.
  const [confirmingClear, setConfirmingClear] = useState(false)

  const router = useRouter()
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, revealed])

  const outOfCredits = left !== null && left <= 0

  async function clearChat() {
    setConfirmingClear(false)
    setBusy(true)
    try {
      const res = await clearGuidedChat(topicId)
      if (!res.ok) throw new Error('Could not clear the chat. Try signing in again.')
      setTurns([])
      setRevealed({})
      setSessionId(undefined)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear the chat.')
    } finally {
      setBusy(false)
      router.refresh()
    }
  }

  /**
   * `intent` tells the server which button was pressed, and the server uses it
   * to decide whether the answer key overrides the model. Re-explaining a step
   * is the one case where the client's stored wording must not come back: it is
   * the wording the student has just said they did not follow.
   */
  async function ask(text: string, intent: 'ask' | 'explain' = 'ask') {
    const message = text.trim()
    if (!message || busy) return

    setError(null)
    setBusy(true)
    setInput('')

    const pendingId = `pending-${turns.length}`
    setTurns((t) => [
      ...t,
      { id: `u-${t.length}`, role: 'USER', content: message, steps: [] },
      { id: pendingId, role: 'ASSISTANT', content: '', steps: [] },
    ])

    try {
      const res = await fetch('/api/guided', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, topicId, sessionId, intent }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(
          body.error === 'OUT_OF_CREDITS'
            ? 'You have used all of today’s credits. They reset at midnight UTC.'
            : (body.message ?? body.error ?? 'The tutor is unavailable right now.'),
        )
      }

      if (body.charged) setLeft((c) => (c === null ? c : Math.max(0, c - 1)))
      if (body.sessionId) setSessionId(body.sessionId)

      const answered: GuidedTurn = {
        id: body.id ?? pendingId,
        role: 'ASSISTANT',
        content: body.answer ?? '',
        steps: Array.isArray(body.steps) ? body.steps : [],
      }
      setTurns((t) => t.map((turn) => (turn.id === pendingId ? answered : turn)))
      // A fresh answer opens at its first step in gated mode, and whole
      // otherwise. Stored per message, so flipping the toggle later does not
      // lose where a student had got to.
      setRevealed((r) => ({ ...r, [answered.id]: answered.steps.length > 0 ? 1 : 0 }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setTurns((t) => t.filter((turn) => turn.id !== pendingId))
    } finally {
      setBusy(false)
      router.refresh()
    }
  }

  return (
    <div className="flex h-[calc(100dvh-6rem)] flex-col rounded-3xl card-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/10 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl flame-gradient text-white">
            <IconRobot className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-navy-deep">Guided Practice</p>
            <p className="truncate text-xs font-semibold text-navy/45">{topicLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-navy/8 p-1 text-xs font-bold">
            <button
              onClick={() => setGated(true)}
              className={clsx(
                'rounded-full px-3 py-1.5 transition',
                gated ? 'bg-surface text-navy-deep shadow-sm' : 'text-navy/50 hover:text-navy-deep',
              )}
            >
              Step by step
            </button>
            <button
              onClick={() => setGated(false)}
              className={clsx(
                'rounded-full px-3 py-1.5 transition',
                gated ? 'text-navy/50 hover:text-navy-deep' : 'bg-surface text-navy-deep shadow-sm',
              )}
            >
              Whole answer
            </button>
          </div>
          {left !== null && (
            <span className="rounded-full bg-navy/8 px-3 py-1.5 text-xs font-bold text-navy/60">
              {left} left today
            </span>
          )}

          {turns.length > 0 &&
            (confirmingClear ? (
              <span className="flex items-center gap-1.5 text-xs font-bold">
                <button
                  onClick={clearChat}
                  disabled={busy}
                  className="rounded-full bg-ember px-3 py-1.5 text-white transition hover:brightness-105 disabled:opacity-50"
                >
                  Clear it
                </button>
                <button
                  onClick={() => setConfirmingClear(false)}
                  className="rounded-full px-2 py-1.5 text-navy/50 transition hover:text-navy-deep"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmingClear(true)}
                className="rounded-full border border-navy/15 px-3 py-1.5 text-xs font-bold text-navy/55 transition hover:border-ember hover:text-ember"
              >
                Clear chat
              </button>
            ))}
        </div>
      </header>

      <div className="scroll-slim flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {turns.length === 0 && (
          <div className="mx-auto max-w-md pt-10 text-center">
            <p className="font-extrabold text-navy-deep">Ask about this topic</p>
            <p className="mt-1 text-sm font-semibold text-navy/45">
              You get the answer first, then the working one step at a time. Questions outside this
              topic are not answered here.
            </p>
            <div className="mt-5 grid gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-2xl border border-navy/10 bg-surface px-4 py-2.5 text-left text-sm font-semibold text-navy-deep transition hover:border-amber"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) =>
          turn.role === 'USER' ? (
            <div key={turn.id} className="flex animate-rise justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-navy-solid px-4 py-2.5 text-[15px] font-semibold leading-relaxed text-white">
                {turn.content}
              </div>
            </div>
          ) : (
            <Answer
              key={turn.id}
              turn={turn}
              gated={gated}
              revealed={revealed[turn.id] ?? turn.steps.length}
              onReveal={() =>
                setRevealed((r) => ({
                  ...r,
                  [turn.id]: Math.min((r[turn.id] ?? 1) + 1, turn.steps.length),
                }))
              }
              onExplainAgain={(step, n) =>
                ask(`Explain step ${n} again in simpler words: ${step}`, 'explain')
              }
              busy={busy}
            />
          ),
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p
          role="alert"
          className="mx-5 mb-2 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void ask(input)
        }}
        className="flex items-end gap-2 border-t border-navy/10 p-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(input)
            }
          }}
          rows={1}
          placeholder={outOfCredits ? 'No credits left today' : 'Ask a question about this topic…'}
          disabled={outOfCredits}
          className="scroll-slim max-h-40 min-h-11 flex-1 resize-y rounded-2xl border border-navy/15 bg-surface px-4 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim() || outOfCredits}
          className="grid size-11 shrink-0 place-items-center rounded-2xl flame-gradient text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-40"
          aria-label="Ask"
        >
          <IconSend className="size-5" />
        </button>
      </form>
    </div>
  )
}

function Answer({
  turn,
  gated,
  revealed,
  onReveal,
  onExplainAgain,
  busy,
}: {
  turn: GuidedTurn
  gated: boolean
  revealed: number
  onReveal: () => void
  onExplainAgain: (step: string, n: number) => void
  busy: boolean
}) {
  if (!turn.content) {
    return (
      <div className="flex animate-rise justify-start">
        <div className="rounded-2xl bg-navy/6 px-4 py-2.5 text-[15px]">
          <span className="inline-block animate-pulse font-medium text-navy/40">thinking…</span>
        </div>
      </div>
    )
  }

  const total = turn.steps.length
  const shown = gated ? Math.min(revealed, total) : total
  const done = shown >= total
  const current = turn.steps[shown - 1]

  return (
    <div className="flex animate-rise justify-start">
      <div className="w-full max-w-[85%] space-y-3">
        <div className="rounded-2xl bg-navy/6 px-4 py-3 text-[15px] font-medium leading-relaxed text-navy-deep">
          <p className="mb-1 text-[11px] font-extrabold tracking-wider text-navy/40">ANSWER</p>
          <Markdown>{turn.content}</Markdown>
        </div>

        {total > 0 && (
          <div className="rounded-2xl border border-navy/10 bg-surface px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-extrabold tracking-wider text-navy/40">HOW WE GET IT</p>
              <p className="text-[11px] font-bold text-navy/40">
                Step {shown} of {total}
              </p>
            </div>

            <ol className="space-y-2.5">
              {turn.steps.slice(0, shown).map((step, i) => (
                <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-navy-deep">
                  <span
                    className={clsx(
                      'grid size-6 shrink-0 place-items-center rounded-full text-xs font-extrabold',
                      i + 1 < shown ? 'bg-moss/15 text-moss' : 'flame-gradient text-white',
                    )}
                  >
                    {i + 1 < shown ? <IconCheck className="size-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0 font-medium">
                    <Markdown>{step}</Markdown>
                  </div>
                </li>
              ))}
            </ol>

            {gated && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-navy/8 pt-3">
                {!done && (
                  <button
                    onClick={onReveal}
                    className="rounded-xl bg-moss px-3.5 py-2 text-sm font-extrabold text-white transition hover:brightness-105"
                  >
                    Got it — next step
                  </button>
                )}
                {current && (
                  <button
                    onClick={() => onExplainAgain(current, shown)}
                    disabled={busy}
                    className="rounded-xl border border-navy/15 px-3.5 py-2 text-sm font-bold text-navy/60 transition hover:border-amber hover:text-navy-deep disabled:opacity-50"
                  >
                    Explain this step again
                  </button>
                )}
                {done && (
                  <p className="py-2 text-sm font-bold text-moss">
                    That’s the whole working — ask the next question when you’re ready.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
