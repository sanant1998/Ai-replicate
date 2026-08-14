'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { IconRobot, IconSend } from '@/components/icons'

export type ChatTurn = { id: string; role: 'USER' | 'ASSISTANT'; content: string }

type Props = {
  chapterId?: string
  chapterLabel?: string
  /** 'career' swaps the tutor's system prompt for career guidance. */
  mode?: 'career'
  initialSessionId?: string
  initialMessages: ChatTurn[]
  credits: number
  suggestions: string[]
}

export function TutorChat({
  chapterId,
  chapterLabel,
  mode,
  initialSessionId,
  initialMessages,
  credits,
  suggestions,
}: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>(initialMessages)
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [left, setLeft] = useState(credits)

  const router = useRouter()
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns])

  async function send(text: string) {
    const message = text.trim()
    if (!message || busy) return

    setError(null)
    setBusy(true)
    setInput('')
    setTurns((t) => [
      ...t,
      { id: `u-${t.length}`, role: 'USER', content: message },
      { id: `a-${t.length}`, role: 'ASSISTANT', content: '' },
    ])

    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, chapterId, sessionId, mode }),
      })

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          body.error === 'OUT_OF_CREDITS'
            ? 'You have used all of today’s credits. They reset at midnight UTC.'
            : (body.message ?? body.error ?? 'The tutor is unavailable right now.'),
        )
      }

      setLeft((c) => Math.max(0, c - 1))

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // Parse the SSE frames as they arrive.
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''

        for (const frame of frames) {
          const event = /^event: (.+)$/m.exec(frame)?.[1]
          const raw = /^data: (.+)$/m.exec(frame)?.[1]
          if (!event || !raw) continue
          const data = JSON.parse(raw)

          if (event === 'session') setSessionId(data.sessionId)
          if (event === 'error') setError(data.message)
          if (event === 'delta') {
            setTurns((t) => {
              const next = [...t]
              const last = next[next.length - 1]
              next[next.length - 1] = { ...last, content: last.content + data.text }
              return next
            })
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setTurns((t) => t.slice(0, -1)) // drop the empty assistant bubble
    } finally {
      setBusy(false)
      // Re-render the server layout so the sidebar's credit counter matches the header.
      router.refresh()
    }
  }

  return (
    <div className="flex h-[calc(100dvh-6rem)] flex-col rounded-3xl card-surface">
      <header className="flex items-center justify-between gap-3 border-b border-navy/10 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl flame-gradient text-white">
            <IconRobot className="size-5" />
          </span>
          <div>
            <p className="font-extrabold text-navy-deep">AI Tutor</p>
            <p className="text-xs font-semibold text-navy/45">
              {chapterLabel ?? 'General questions across your syllabus'}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-navy/8 px-3 py-1.5 text-xs font-bold text-navy/60">
          {left} credits left today
        </span>
      </header>

      <div className="scroll-slim flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {turns.length === 0 && (
          <div className="mx-auto max-w-md pt-10 text-center">
            <p className="font-extrabold text-navy-deep">What are we working on?</p>
            <p className="mt-1 text-sm font-semibold text-navy/45">
              Ask anything. The tutor guides you rather than handing over answers.
            </p>
            <div className="mt-5 grid gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-2xl border border-navy/10 bg-white px-4 py-2.5 text-left text-sm font-semibold text-navy-deep transition hover:border-amber"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t) => (
          <div
            key={t.id}
            className={clsx('flex animate-rise', t.role === 'USER' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={clsx(
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
                t.role === 'USER'
                  ? 'bg-navy font-semibold text-white'
                  : 'bg-navy/6 font-medium text-navy-deep',
              )}
            >
              {t.content || <span className="inline-block animate-pulse text-navy/40">thinking…</span>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="mx-5 mb-2 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="flex items-end gap-2 border-t border-navy/10 p-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(input)
            }
          }}
          rows={1}
          placeholder={left > 0 ? 'Ask a question…' : 'No credits left today'}
          disabled={left <= 0}
          className="scroll-slim max-h-40 min-h-11 flex-1 resize-y rounded-2xl border border-navy/15 bg-white px-4 py-2.5 font-semibold text-navy-deep outline-none transition focus:border-amber disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim() || left <= 0}
          className="grid size-11 shrink-0 place-items-center rounded-2xl flame-gradient text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-40"
          aria-label="Send"
        >
          <IconSend className="size-5" />
        </button>
      </form>
    </div>
  )
}
