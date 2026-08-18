'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { compile, ExpressionError, type AngleMode } from '@/lib/expression'
import { ShellCard, ShellPanel, ToolShell, type ShellTab } from '../ToolShell'

type HistoryEntry = { expression: string; result: string }

/** Trailing zeros and float noise make answers hard to read; 12 digits is plenty. */
function present(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : Number.isNaN(value) ? 'undefined' : '-∞'
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value)
  const rounded = Number(value.toPrecision(12))
  if (Math.abs(rounded) >= 1e12 || (Math.abs(rounded) < 1e-6 && rounded !== 0)) {
    return rounded.toExponential(6).replace(/e([+-])(\d)$/, 'e$10$2')
  }
  return String(rounded)
}

type Key = {
  label: string
  /** Text inserted into the expression; defaults to the label. */
  insert?: string
  action?: 'equals' | 'clear' | 'back'
  tone?: 'default' | 'function' | 'operator' | 'accent'
  wide?: boolean
  title?: string
}

const KEYS: Key[] = [
  { label: 'AC', action: 'clear', tone: 'accent', title: 'Clear everything' },
  { label: '( )', insert: '(', tone: 'function' },
  { label: ')', insert: ')', tone: 'function' },
  { label: '⌫', action: 'back', tone: 'function', title: 'Backspace' },
  { label: '÷', insert: '/', tone: 'operator' },

  { label: 'sin', insert: 'sin(', tone: 'function' },
  { label: 'cos', insert: 'cos(', tone: 'function' },
  { label: 'tan', insert: 'tan(', tone: 'function' },
  { label: 'x^y', insert: '^', tone: 'function', title: 'Power' },
  { label: '×', insert: '*', tone: 'operator' },

  { label: 'ln', insert: 'ln(', tone: 'function', title: 'Natural log' },
  { label: 'log', insert: 'log(', tone: 'function', title: 'Log base 10' },
  { label: '√', insert: '√', tone: 'function', title: 'Square root' },
  { label: 'x!', insert: '!', tone: 'function', title: 'Factorial' },
  { label: '−', insert: '-', tone: 'operator' },

  { label: '7' },
  { label: '8' },
  { label: '9' },
  { label: 'π', insert: 'pi', tone: 'function' },
  { label: '+', insert: '+', tone: 'operator' },

  { label: '4' },
  { label: '5' },
  { label: '6' },
  { label: 'e', insert: 'e', tone: 'function', title: "Euler's number" },
  { label: '=', action: 'equals', tone: 'accent' },

  { label: '1' },
  { label: '2' },
  { label: '3' },
  { label: '0' },
  { label: '.' },
]

const IconCalc = (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h4M8 18h.01M12 18h.01" />
  </svg>
)

const tabIcon = (path: string) => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
)

const TABS: ShellTab[] = [
  { id: 'history', label: 'History', icon: tabIcon('M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2') },
  { id: 'help', label: 'Help', icon: tabIcon('M12 17h.01M9.1 9a3 3 0 1 1 4 2.8c-.7.3-1.1 1-1.1 1.7M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z') },
  { id: 'about', label: 'About', icon: tabIcon('M12 8h.01M11 12h1v4h1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z') },
]

export function ScientificCalculator({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('history')
  const [expression, setExpression] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [angleMode, setAngleMode] = useState<AngleMode>('deg')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // A running answer under the input, so a mistake is visible before pressing =.
  // Derived from what is already in state, so it is computed during render
  // rather than pushed in from an effect.
  const preview = useMemo(() => {
    if (!expression.trim()) return ''
    try {
      return present(compile(expression).evaluate({ angleMode }))
    } catch {
      // Mid-typing expressions are incomplete far more often than they are
      // wrong, so the preview simply goes quiet rather than shouting.
      return ''
    }
  }, [expression, angleMode])

  const evaluateNow = useCallback(() => {
    if (!expression.trim()) return
    try {
      const value = compile(expression).evaluate({ angleMode })
      const result = present(value)
      setHistory((h) => [{ expression, result }, ...h].slice(0, 30))
      setExpression(result === 'undefined' ? '' : result)
      setError(null)
    } catch (err) {
      setError(err instanceof ExpressionError ? err.message : 'That expression could not be read')
    }
  }, [expression, angleMode])

  function press(key: Key) {
    setError(null)
    if (key.action === 'clear') {
      setExpression('')
      return
    }
    if (key.action === 'back') {
      setExpression((e) => e.slice(0, -1))
      return
    }
    if (key.action === 'equals') {
      evaluateNow()
      return
    }
    setExpression((e) => e + (key.insert ?? key.label))
    inputRef.current?.focus()
  }

  const sidebar = (
    <>
      {tab === 'history' && (
        <ShellCard title="History">
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold" style={{ color: 'var(--shell-muted)' }}>
              Answers appear here.
            </p>
          ) : (
            <>
              <ul className="space-y-1">
                {history.map((h, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setExpression(h.expression)}
                      title="Put this expression back in the input"
                      className="w-full rounded-lg px-2 py-1.5 text-right transition hover:brightness-95"
                    >
                      <span className="block truncate font-mono text-xs" style={{ color: 'var(--shell-muted)' }}>
                        {h.expression}
                      </span>
                      <span className="block truncate font-mono text-sm font-bold">{h.result}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setHistory([])}
                className="mt-2 w-full rounded-lg py-1.5 text-xs font-bold text-ember transition hover:brightness-110"
              >
                Clear history
              </button>
            </>
          )}
        </ShellCard>
      )}

      {tab === 'help' && (
        <ShellCard title="How to use">
          <ul className="space-y-2 text-sm font-semibold leading-relaxed">
            <li>Type directly in the display, or use the keys. Enter evaluates.</li>
            <li>The answer under the input updates as you type.</li>
            <li>Switch DEG/RAD before using trigonometry.</li>
            <li>
              Functions: <code className="font-mono">sin cos tan ln log sqrt abs exp min max</code>.
            </li>
          </ul>
        </ShellCard>
      )}

      {tab === 'about' && (
        <ShellCard title="About">
          <p className="text-sm font-semibold leading-relaxed">
            Expressions are parsed, never <code className="font-mono">eval</code>&apos;d. Precedence
            follows mathematical convention — <code className="font-mono">-2^2</code> is −4, and{' '}
            <code className="font-mono">2^3^2</code> is 512.
          </p>
        </ShellCard>
      )}
    </>
  )

  return (
    <ToolShell
      title="Scientific Calculator"
      subtitle="Trigonometry, logs and powers"
      icon={IconCalc}
      version="Scientific Calculator v1.0"
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      sidebar={sidebar}
      onClose={onClose}
    >
      <ShellPanel className="mx-auto max-w-2xl">
        <div>
          <div className="rounded-2xl bg-navy-solid-deep px-4 py-3 text-right">
          <label className="sr-only" htmlFor="calc-expression">
            Expression
          </label>
          <input
            id="calc-expression"
            ref={inputRef}
            value={expression}
            onChange={(e) => {
              setExpression(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                evaluateNow()
              }
            }}
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0"
            aria-describedby="calc-preview"
            className="w-full bg-transparent text-right font-mono text-2xl font-bold text-white outline-none placeholder:text-white/30"
          />
          <p
            id="calc-preview"
            aria-live="polite"
            className="mt-1 min-h-6 font-mono text-sm font-semibold text-amber"
          >
            {error ? <span className="text-ember">{error}</span> : preview && `= ${preview}`}
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div
            role="group"
            aria-label="Angle unit"
            className="inline-flex rounded-xl border border-navy/15 bg-surface p-0.5"
          >
            {(['deg', 'rad'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAngleMode(mode)}
                aria-pressed={angleMode === mode}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-xs font-extrabold uppercase transition',
                  angleMode === mode ? 'bg-navy-solid text-white' : 'text-navy/55 hover:text-navy',
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="text-xs font-semibold text-navy/45">
            Type directly, or use the keys. Enter evaluates.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {KEYS.map((key) => (
            <button
              key={key.label}
              type="button"
              onClick={() => press(key)}
              title={key.title}
              className={clsx(
                'min-h-11 rounded-xl text-sm font-extrabold transition active:scale-95 motion-reduce:active:scale-100',
                key.tone === 'accent' && 'flame-gradient text-white shadow-sm shadow-ember/25',
                key.tone === 'operator' && 'bg-navy-solid text-white hover:brightness-125',
                key.tone === 'function' && 'bg-navy/10 text-navy-deep hover:bg-navy/15',
                (!key.tone || key.tone === 'default') &&
                  'bg-surface text-navy-deep shadow-sm hover:bg-navy/5',
              )}
            >
              {key.label}
            </button>
          ))}
        </div>
        </div>
      </ShellPanel>
    </ToolShell>
  )
}
