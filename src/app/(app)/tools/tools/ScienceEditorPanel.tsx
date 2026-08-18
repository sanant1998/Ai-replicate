'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Markdown } from '@/components/Markdown'
import { ShellCard, ToolShell, type ShellTab } from '../ToolShell'

const IconDoc = (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
)

const tabIcon = (path: string) => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
)

const TABS: ShellTab[] = [
  { id: 'format', label: 'Format', icon: tabIcon('M4 6h16M4 12h10M4 18h13') },
  { id: 'document', label: 'Document', icon: tabIcon('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5') },
  { id: 'help', label: 'Help', icon: tabIcon('M12 17h.01M9.1 9a3 3 0 1 1 4 2.8c-.7.3-1.1 1-1.1 1.7M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z') },
]

const STORAGE_KEY = 'paperpath:science-editor'

const SAMPLE = `# Photosynthesis

Green plants convert light energy into chemical energy:

$$6CO_2 + 6H_2O \\xrightarrow{light} C_6H_{12}O_6 + 6O_2$$

## Key points

- Happens in the **chloroplast**
- Chlorophyll absorbs mostly red and blue light
- The rate depends on light intensity, $CO_2$ concentration and temperature

The rate equation can be written as $v = \\frac{V_{max}[S]}{K_m + [S]}$.
`

/** A toolbar action wraps the selection, or drops a snippet at the cursor. */
type Action = {
  label: string
  title: string
  before: string
  after?: string
  /** Used when nothing is selected, so the button still produces something useful. */
  placeholder?: string
  block?: boolean
}

const FORMAT: Action[] = [
  { label: 'B', title: 'Bold', before: '**', after: '**', placeholder: 'bold' },
  { label: 'I', title: 'Italic', before: '_', after: '_', placeholder: 'italic' },
  { label: 'H2', title: 'Heading', before: '## ', placeholder: 'Heading', block: true },
  { label: '•', title: 'Bullet list', before: '- ', placeholder: 'item', block: true },
  { label: '1.', title: 'Numbered list', before: '1. ', placeholder: 'item', block: true },
  { label: '“”', title: 'Quote', before: '> ', placeholder: 'quote', block: true },
  { label: '</>', title: 'Code', before: '`', after: '`', placeholder: 'code' },
]

const MATHS: Action[] = [
  { label: '$x$', title: 'Inline maths', before: '$', after: '$', placeholder: 'x' },
  { label: '$$', title: 'Display maths', before: '$$\n', after: '\n$$', placeholder: 'x = y' },
  { label: 'a/b', title: 'Fraction', before: '$\\frac{', after: '}{b}$', placeholder: 'a' },
  { label: '√', title: 'Square root', before: '$\\sqrt{', after: '}$', placeholder: 'x' },
  { label: 'xⁿ', title: 'Superscript', before: '$x^{', after: '}$', placeholder: '2' },
  { label: 'xₙ', title: 'Subscript', before: '$x_{', after: '}$', placeholder: '1' },
  { label: '∑', title: 'Sum', before: '$\\sum_{i=1}^{n} ', after: '$', placeholder: 'i' },
  { label: '∫', title: 'Integral', before: '$\\int_{a}^{b} ', after: '\\,dx$', placeholder: 'f(x)' },
]

const SYMBOLS = [
  '→',
  '⇌',
  '↑',
  '↓',
  '°',
  'Δ',
  'α',
  'β',
  'γ',
  'θ',
  'λ',
  'μ',
  'π',
  'ρ',
  'σ',
  'ω',
  'Ω',
  '±',
  '×',
  '÷',
  '≈',
  '≠',
  '≤',
  '≥',
  '∞',
]

export default function ScienceEditorPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('format')
  // Safe to read storage during the initial render because this panel is loaded
  // with ssr:false — there is no server-rendered HTML for it to disagree with.
  const [text, setText] = useState(() => window.localStorage.getItem(STORAGE_KEY) ?? SAMPLE)
  const [view, setView] = useState<'split' | 'write' | 'read'>('split')
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  // Writing out to storage is what effects are for: pushing React state into an
  // external system. Debounced so a fast typist is not hitting disk per key.
  useEffect(() => {
    const timer = window.setTimeout(() => window.localStorage.setItem(STORAGE_KEY, text), 400)
    return () => window.clearTimeout(timer)
  }, [text])

  const apply = useCallback((action: Action) => {
    const area = areaRef.current
    if (!area) return

    const start = area.selectionStart
    const end = area.selectionEnd
    const value = area.value
    const selected = value.slice(start, end) || action.placeholder || ''
    const after = action.after ?? ''

    // Block actions attach to the start of the line rather than the selection.
    let insertAt = start
    if (action.block) {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      insertAt = lineStart
      const next = value.slice(0, lineStart) + action.before + value.slice(lineStart)
      setText(next)
      queueMicrotask(() => {
        area.focus()
        const caret = start + action.before.length
        area.setSelectionRange(caret, caret)
      })
      return
    }

    const next = value.slice(0, insertAt) + action.before + selected + after + value.slice(end)
    setText(next)
    queueMicrotask(() => {
      area.focus()
      // Leave the inserted placeholder selected so it can be typed straight over.
      area.setSelectionRange(insertAt + action.before.length, insertAt + action.before.length + selected.length)
    })
  }, [])

  const insertSymbol = useCallback((symbol: string) => {
    const area = areaRef.current
    if (!area) return
    const { selectionStart: start, selectionEnd: end, value } = area
    setText(value.slice(0, start) + symbol + value.slice(end))
    queueMicrotask(() => {
      area.focus()
      area.setSelectionRange(start + symbol.length, start + symbol.length)
    })
  }, [])

  /**
   * navigator.clipboard rejects outside a secure context and when permission is
   * refused. Unhandled, that makes the button look dead — it silently does
   * nothing and never reports "Copied". Fall back to the textarea selection,
   * and say so plainly if even that fails.
   */
  async function copy() {
    const done = () => {
      setCopied('done')
      window.setTimeout(() => setCopied(null), 1600)
    }
    try {
      await navigator.clipboard.writeText(text)
      done()
      return
    } catch {
      const area = areaRef.current
      if (area) {
        const { selectionStart, selectionEnd } = area
        area.focus()
        area.select()
        const ok = document.execCommand?.('copy')
        area.setSelectionRange(selectionStart, selectionEnd)
        if (ok) {
          done()
          return
        }
      }
      setCopied('failed')
      window.setTimeout(() => setCopied(null), 2400)
    }
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  const button = 'min-h-9 min-w-9 rounded-lg px-2 text-xs font-extrabold transition hover:brightness-95 active:scale-95 motion-reduce:active:scale-100'
  const buttonStyle = { border: '1px solid var(--shell-line)', background: 'var(--shell-raise)' }

  const sidebar = (
    <>
      {tab === 'format' && (
        <>
          <ShellCard title="Format">
            <div className="flex flex-wrap gap-1.5">
              {FORMAT.map((a) => (
                <button key={a.label} type="button" title={a.title} onClick={() => apply(a)} className={button} style={buttonStyle}>
                  {a.label}
                </button>
              ))}
            </div>
          </ShellCard>
          <ShellCard title="Maths">
            <div className="flex flex-wrap gap-1.5">
              {MATHS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  title={a.title}
                  onClick={() => apply(a)}
                  className={clsx(button, 'font-mono')}
                  style={buttonStyle}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </ShellCard>
          <ShellCard title="Symbols">
            <div className="flex flex-wrap gap-1">
              {SYMBOLS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => insertSymbol(s)}
                  aria-label={`Insert ${s}`}
                  className="size-8 rounded-md text-sm font-bold transition hover:brightness-95"
                  style={{ background: 'var(--shell-active)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </ShellCard>
        </>
      )}

      {tab === 'document' && (
        <ShellCard title="Document">
          <div className="space-y-2">
            <button type="button" onClick={copy} className={clsx(button, 'w-full')} style={buttonStyle}>
              {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Copy blocked' : 'Copy source'}
            </button>
            <button type="button" onClick={() => setText(SAMPLE)} className={clsx(button, 'w-full')} style={buttonStyle}>
              Load example
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear the document? This cannot be undone.')) setText('')
              }}
              className={clsx(button, 'w-full text-ember')}
              style={buttonStyle}
            >
              Clear
            </button>
          </div>
          <p className="mt-3 text-xs font-semibold" style={{ color: 'var(--shell-muted)' }}>
            {words} word{words === 1 ? '' : 's'} · saved in this browser
          </p>
        </ShellCard>
      )}

      {tab === 'help' && (
        <ShellCard title="How to use">
          <ul className="space-y-2 text-sm font-semibold leading-relaxed">
            <li>
              Write in Markdown. Maths goes between <code className="font-mono">$…$</code> for inline
              or <code className="font-mono">$$…$$</code> on its own line.
            </li>
            <li>Select text first and a format button wraps it.</li>
            <li>Your draft is saved in this browser as you type.</li>
          </ul>
        </ShellCard>
      )}
    </>
  )

  return (
    <ToolShell
      title="Science Text Editor"
      subtitle="Notes with equations, typeset live"
      icon={IconDoc}
      version="Science Text Editor v1.0"
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      sidebar={sidebar}
      headerExtra={
        <div
          role="group"
          aria-label="View mode"
          className="inline-flex rounded-xl p-0.5"
          style={{ border: '1px solid var(--shell-line)', background: 'var(--shell-raise)' }}
        >
          {(['write', 'split', 'read'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={clsx(
                'rounded-lg px-2.5 py-1 text-xs font-extrabold capitalize transition',
                view === mode ? 'bg-navy-solid text-white' : 'opacity-60 hover:opacity-100',
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      }
      onClose={onClose}
    >
      <div className={clsx('grid h-full gap-3', view === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1')}>
        {view !== 'read' && (
          <div className="min-h-0">
            <label className="sr-only" htmlFor="science-source">
              Document source
            </label>
            <textarea
              id="science-source"
              ref={areaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck
              className="scroll-slim h-[calc(100dvh-9rem)] min-h-[20rem] w-full resize-none rounded-2xl p-4 font-mono text-sm leading-relaxed outline-none transition focus:border-amber"
              style={{ background: 'var(--shell-panel)', border: '1px solid var(--shell-line)', color: 'var(--shell-text)' }}
            />
          </div>
        )}
        {view !== 'write' && (
          <div
            className="scroll-slim h-[calc(100dvh-9rem)] min-h-[20rem] overflow-y-auto rounded-2xl p-5"
            style={{ background: 'var(--shell-panel)', border: '1px solid var(--shell-line)' }}
          >
            {text.trim() ? (
              <Markdown className="text-[15px] font-medium leading-relaxed">{text}</Markdown>
            ) : (
              <p className="text-sm font-semibold" style={{ color: 'var(--shell-muted)' }}>
                The preview appears here.
              </p>
            )}
          </div>
        )}
      </div>
    </ToolShell>
  )
}
