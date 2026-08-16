'use client'

import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  add,
  determinant,
  identity,
  inverse,
  MatrixError,
  multiply,
  presentNumber,
  rank,
  scale,
  subtract,
  trace,
  transpose,
  type Matrix,
} from '@/lib/matrix'
import { ShellCard, ShellPanel, ToolShell, type ShellTab } from '../ToolShell'

const MAX_SIZE = 8

type Grid = string[][]

const blank = (r: number, c: number): Grid => Array.from({ length: r }, () => new Array(c).fill(''))

const resize = (grid: Grid, r: number, c: number): Grid =>
  Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => grid[i]?.[j] ?? ''))

/**
 * Transposes the *text* grid. The numeric `transpose` in lib/matrix cannot be
 * reused here: this runs on what is currently typed, including half-entered
 * values like "-" that are not numbers yet.
 */
const transposeGrid = (grid: Grid): Grid =>
  Array.from({ length: grid[0]?.length ?? 0 }, (_, j) => grid.map((row) => row[j] ?? ''))

function toMatrix(grid: Grid, label: string): Matrix {
  return grid.map((row, i) =>
    row.map((cell, j) => {
      const text = cell.trim()
      if (text === '') return 0
      const value = Number(text)
      if (!Number.isFinite(value)) {
        throw new MatrixError(`${label} row ${i + 1}, column ${j + 1} is not a number`)
      }
      return value
    }),
  )
}

const icon = (path: string) => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
)

const IconGrid = (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
)

const TABS: ShellTab[] = [
  { id: 'operations', label: 'Operations', icon: icon('M5 12h14M12 5v14') },
  { id: 'help', label: 'Help', icon: icon('M12 17h.01M9.1 9a3 3 0 1 1 4 2.8c-.7.3-1.1 1-1.1 1.7M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z') },
  { id: 'examples', label: 'Examples', icon: icon('M4 7h16M4 12h16M4 17h10') },
  { id: 'about', label: 'About', icon: icon('M12 8h.01M11 12h1v4h1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z') },
]

type Result = { title: string; matrix?: Matrix; scalar?: string }

export function MatrixCalculator({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('operations')
  const [a, setA] = useState<Grid>([
    ['1', '0', '0'],
    ['0', '1', '0'],
    ['0', '0', '1'],
  ])
  const [b, setB] = useState<Grid>([
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ])
  const [scalar, setScalar] = useState('2')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)

  const A = () => toMatrix(a, 'Matrix A')
  const B = () => toMatrix(b, 'Matrix B')
  const k = () => {
    const value = Number(scalar.trim())
    if (!Number.isFinite(value)) throw new MatrixError('The scalar k is not a number')
    return value
  }

  const OPERATIONS: { id: string; label: string; glyph: string; fn: () => Matrix | number }[] = [
    { id: 'add', label: 'Add', glyph: '+', fn: () => add(A(), B()) },
    { id: 'sub', label: 'Subtract', glyph: '−', fn: () => subtract(A(), B()) },
    { id: 'mul', label: 'Multiply', glyph: '×', fn: () => multiply(A(), B()) },
    { id: 'mulba', label: 'Multiply (B × A)', glyph: '×', fn: () => multiply(B(), A()) },
    { id: 'scale', label: 'Scalar × A', glyph: 'k', fn: () => scale(A(), k()) },
    { id: 'transpose', label: 'Transpose', glyph: '⇄', fn: () => transpose(A()) },
    { id: 'det', label: 'Determinant', glyph: '#', fn: () => determinant(A()) },
    { id: 'inv', label: 'Inverse', glyph: '⁻¹', fn: () => inverse(A()) },
    { id: 'rank', label: 'Rank', glyph: 'r', fn: () => rank(A()) },
    { id: 'trace', label: 'Trace', glyph: 'tr', fn: () => trace(A()) },
  ]

  function run(op: (typeof OPERATIONS)[number]) {
    setActive(op.id)
    try {
      const value = op.fn()
      setError(null)
      setResult(
        typeof value === 'number'
          ? { title: op.label, scalar: presentNumber(value) }
          : { title: op.label, matrix: value },
      )
    } catch (err) {
      setResult(null)
      setError(err instanceof MatrixError ? err.message : 'That operation could not be completed')
    }
  }

  const sidebar = (
    <>
      {tab === 'operations' && (
        <ShellCard title="Select operation">
          <ul className="space-y-1.5">
            {OPERATIONS.map((op) => (
              <li key={op.id}>
                <button
                  type="button"
                  onClick={() => run(op)}
                  className={clsx(
                    'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-extrabold transition',
                    active === op.id ? 'border-2 border-navy text-navy' : 'border',
                  )}
                  style={
                    active === op.id
                      ? { background: 'var(--shell-active)' }
                      : { borderColor: 'var(--shell-line)', background: 'var(--shell-raise)' }
                  }
                >
                  <span className="w-5 text-center font-mono opacity-60">{op.glyph}</span>
                  {op.label}
                </button>
              </li>
            ))}
          </ul>
        </ShellCard>
      )}

      {tab === 'help' && (
        <ShellCard title="How to use">
          <ol className="list-decimal space-y-2 pl-4 text-sm font-semibold leading-relaxed">
            <li>Set the size of each matrix with the Rows and Columns boxes.</li>
            <li>Type the values. An empty cell counts as 0.</li>
            <li>Pick an operation from the Operations tab.</li>
          </ol>
          <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--shell-muted)' }}>
            Add and Subtract need identical sizes. To multiply, A&apos;s columns must equal B&apos;s
            rows. Determinant, Inverse and Trace need a square matrix.
          </p>
        </ShellCard>
      )}

      {tab === 'examples' && (
        <ShellCard title="Try these">
          <div className="space-y-2">
            {[
              { label: '2×2 identity check', run: () => { setA(identity(2).map((r) => r.map(String))); setB([['4', '7'], ['2', '6']]) } },
              { label: 'Invertible 2×2', run: () => { setA([['4', '7'], ['2', '6']]); setB(identity(2).map((r) => r.map(String))) } },
              { label: 'Singular matrix', run: () => { setA([['1', '2'], ['2', '4']]); setB(identity(2).map((r) => r.map(String))) } },
              { label: '3×3 magic square', run: () => { setA([['2', '7', '6'], ['9', '5', '1'], ['4', '3', '8']]); setB(identity(3).map((r) => r.map(String))) } },
            ].map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => { ex.run(); setResult(null); setError(null) }}
                className="min-h-10 w-full rounded-xl px-3 text-left text-sm font-bold transition"
                style={{ border: '1px solid var(--shell-line)', background: 'var(--shell-raise)' }}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </ShellCard>
      )}

      {tab === 'about' && (
        <ShellCard title="About">
          <p className="text-sm font-semibold leading-relaxed">
            Determinant and inverse use Gaussian elimination with partial pivoting rather than the
            cofactor expansion taught in class — same answer, but stable on larger matrices.
          </p>
        </ShellCard>
      )}
    </>
  )

  return (
    <ToolShell
      title="Matrix Calculator"
      subtitle="Add, multiply, invert and more"
      icon={IconGrid}
      version="Matrix Calculator v1.0"
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      sidebar={sidebar}
      onClose={onClose}
    >
      <ShellPanel>
        <div className="grid gap-6 xl:grid-cols-2">
          <MatrixInput label="A" grid={a} onChange={setA} other={b} onCopyFrom={() => setA(b.map((r) => [...r]))} />
          <MatrixInput label="B" grid={b} onChange={setB} other={a} onCopyFrom={() => setB(a.map((r) => [...r]))} />
        </div>

        <label className="mt-5 flex items-center gap-2">
          <span className="text-sm font-extrabold">Scalar k</span>
          <input
            value={scalar}
            onChange={(e) => setScalar(e.target.value)}
            inputMode="decimal"
            className="w-24 rounded-lg px-2 py-1.5 text-center font-mono text-sm font-semibold outline-none transition focus:border-amber"
            style={{ background: 'var(--shell-raise)', border: '1px solid var(--shell-line)', color: 'var(--shell-text)' }}
          />
        </label>

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
            {error}
          </p>
        )}

        {result && (
          <div role="region" aria-label="Result" aria-live="polite" className="mt-5 rounded-2xl border border-moss/30 bg-moss/8 p-4">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-moss">{result.title}</p>
            {result.scalar !== undefined ? (
              <p className="font-mono text-3xl font-extrabold">{result.scalar}</p>
            ) : (
              <div className="scroll-slim overflow-x-auto">
                <table className="border-collapse">
                  <tbody>
                    {result.matrix!.map((row, i) => (
                      <tr key={i}>
                        {row.map((v, j) => (
                          <td
                            key={j}
                            className="min-w-16 px-3 py-2 text-center font-mono text-sm font-bold"
                            style={{ border: '1px solid var(--shell-line)', background: 'var(--shell-raise)' }}
                          >
                            {presentNumber(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!result && !error && (
          <p className="mt-5 rounded-2xl px-3 py-10 text-center text-sm font-semibold" style={{ background: 'var(--shell-active)', color: 'var(--shell-muted)' }}>
            Choose an operation from the sidebar to see the result.
          </p>
        )}
      </ShellPanel>
    </ToolShell>
  )
}

function ToolButton({ children, title, onClick }: { children: ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-lg transition hover:brightness-95"
      style={{ border: '1px solid var(--shell-line)', background: 'var(--shell-raise)' }}
    >
      {children}
    </button>
  )
}

function MatrixInput({
  label,
  grid,
  onChange,
  other,
  onCopyFrom,
}: {
  label: string
  grid: Grid
  onChange: (g: Grid) => void
  other: Grid
  onCopyFrom: () => void
}) {
  const r = grid.length
  const c = grid[0]?.length ?? 0
  const clamp = (n: number) => Math.max(1, Math.min(MAX_SIZE, Math.round(n) || 1))

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-extrabold">Matrix {label}</h3>
        <button
          type="button"
          // Writes 1s down the diagonal of the *current* shape. Using
          // identity(min(r,c)) would silently resize a 3×4 matrix to 3×3.
          onClick={() =>
            onChange(
              Array.from({ length: r }, (_, i) =>
                Array.from({ length: c }, (_, j) => (i === j ? '1' : '0')),
              ),
            )
          }
          className="min-h-9 rounded-lg px-3 text-xs font-extrabold transition"
          style={{ border: '1px solid var(--shell-line)', background: 'var(--shell-raise)' }}
        >
          Identity
        </button>
        <button
          type="button"
          onClick={() => onChange(grid.map((row) => row.map(() => String(Math.floor(Math.random() * 19) - 9))))}
          className="min-h-9 rounded-lg px-3 text-xs font-extrabold transition"
          style={{ border: '1px solid var(--shell-line)', background: 'var(--shell-raise)' }}
        >
          Random
        </button>
        <ToolButton title={`Copy the other matrix into ${label}`} onClick={onCopyFrom}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h8" />
          </svg>
        </ToolButton>
        <ToolButton title={`Transpose ${label} in place`} onClick={() => onChange(transposeGrid(grid))}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M4 8h12l-3-3M20 16H8l3 3" />
          </svg>
        </ToolButton>
        <ToolButton title={`Clear ${label}`} onClick={() => onChange(blank(r, c))}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
          </svg>
        </ToolButton>
        <span className="sr-only">{other.length} rows in the other matrix</span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        {(
          [
            ['Rows', r, (n: number) => onChange(resize(grid, clamp(n), c))],
            ['Columns', c, (n: number) => onChange(resize(grid, r, clamp(n)))],
          ] as const
        ).map(([name, value, set]) => (
          <label key={name}>
            <span className="mb-1 block text-xs font-bold" style={{ color: 'var(--shell-muted)' }}>
              {name}
            </span>
            <input
              type="number"
              min={1}
              max={MAX_SIZE}
              value={value}
              aria-label={`${name} in matrix ${label}`}
              onChange={(e) => set(Number(e.target.value))}
              className="min-h-11 w-full rounded-xl px-3 font-semibold outline-none transition focus:border-amber"
              style={{ background: 'var(--shell-raise)', border: '1px solid var(--shell-line)', color: 'var(--shell-text)' }}
            />
          </label>
        ))}
      </div>

      <div className="scroll-slim overflow-x-auto rounded-2xl p-3" style={{ background: 'var(--shell-active)' }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${c}, minmax(3.5rem, 1fr))` }}>
          {grid.map((row, i) =>
            row.map((cell, j) => (
              <input
                key={`${i}-${j}`}
                value={cell}
                inputMode="decimal"
                aria-label={`Matrix ${label} row ${i + 1} column ${j + 1}`}
                onChange={(e) => {
                  const next = grid.map((r2) => [...r2])
                  next[i]![j] = e.target.value
                  onChange(next)
                }}
                className="min-h-12 w-full rounded-xl px-1.5 text-center font-mono text-sm font-semibold outline-none transition focus:border-amber"
                style={{ background: 'var(--shell-raise)', border: '1px solid var(--shell-line)', color: 'var(--shell-text)' }}
              />
            )),
          )}
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--shell-muted)' }}>
        {r}×{c} · empty cells count as 0
      </p>
    </div>
  )
}
