'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  ELEMENTS,
  gridPosition,
  type ChemElement,
  type ElementCategory,
} from '@/lib/elements'
import { ShellCard, ToolShell, type ShellTab } from '../ToolShell'

const STATE_LABELS: Record<ChemElement['state'], string> = {
  solid: 'Solid',
  liquid: 'Liquid',
  gas: 'Gas',
  unknown: 'Unknown',
}

/** Legend swatch colours, matched to the category tile classes. */
const DOT: Record<ElementCategory, string> = {
  alkali: 'bg-rose-500',
  alkaline: 'bg-orange-500',
  transition: 'bg-amber-500',
  'post-transition': 'bg-teal-500',
  metalloid: 'bg-emerald-500',
  nonmetal: 'bg-sky-500',
  halogen: 'bg-cyan-500',
  noble: 'bg-violet-500',
  lanthanide: 'bg-fuchsia-500',
  actinide: 'bg-pink-500',
  unknown: 'bg-slate-400',
}

const IconAtom = (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7}>
    <circle cx="12" cy="12" r="2.2" />
    <ellipse cx="12" cy="12" rx="10" ry="4.4" />
    <ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)" />
    <ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(120 12 12)" />
  </svg>
)

const icon = (path: string) => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
)

const TABS: ShellTab[] = [
  { id: 'elements', label: 'Elements', icon: icon('M4 6h16M4 12h16M4 18h10') },
  { id: 'legend', label: 'Categories', icon: icon('M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z') },
  { id: 'about', label: 'About', icon: icon('M12 8h.01M11 12h1v4h1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z') },
]

export function PeriodicTable({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('elements')
  const [selected, setSelected] = useState<ChemElement | null>(null)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState<ElementCategory | null>(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return new Set(
      ELEMENTS.filter(
        (el) =>
          el.name.toLowerCase().includes(q) ||
          el.symbol.toLowerCase() === q ||
          el.symbol.toLowerCase().startsWith(q) ||
          String(el.z) === q,
      ).map((el) => el.z),
    )
  }, [query])

  const categories = Object.keys(CATEGORY_LABELS) as ElementCategory[]

  const sidebar = (
    <>
      {tab === 'elements' && (
        <>
          <div className="relative mb-3">
            <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-45" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search elements"
              placeholder="Search element…"
              className="min-h-11 w-full rounded-xl pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-amber"
              style={{ background: 'var(--shell-raise)', border: '1px solid var(--shell-line)', color: 'var(--shell-text)' }}
            />
          </div>
          {matches && (
            <p className="mb-3 text-xs font-bold" style={{ color: 'var(--shell-muted)' }}>
              {matches.size} match{matches.size === 1 ? '' : 'es'}
            </p>
          )}
          <ShellCard title="Selected">
            {selected ? (
              <ElementDetail el={selected} />
            ) : (
              <div className="py-6 text-center">
                <span className="mx-auto block w-fit opacity-30">{IconAtom}</span>
                <p className="mt-2 text-sm font-bold" style={{ color: 'var(--shell-muted)' }}>
                  Click any element
                </p>
                <p className="text-xs font-semibold opacity-70" style={{ color: 'var(--shell-muted)' }}>
                  to see its details
                </p>
              </div>
            )}
          </ShellCard>
        </>
      )}

      {tab === 'legend' && (
        <ShellCard title="Categories">
          <ul className="space-y-0.5">
            <li>
              <button
                type="button"
                onClick={() => setHighlight(null)}
                aria-pressed={highlight === null}
                className={clsx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-bold transition')}
                style={highlight === null ? { background: 'var(--shell-active)' } : undefined}
              >
                <span className="size-2.5 shrink-0 rounded-full bg-slate-500" />
                All Elements
              </button>
            </li>
            {categories.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => setHighlight((h) => (h === c ? null : c))}
                  aria-pressed={highlight === c}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition"
                  style={highlight === c ? { background: 'var(--shell-active)' } : undefined}
                >
                  <span className={clsx('size-2.5 shrink-0 rounded-full', DOT[c])} />
                  {CATEGORY_LABELS[c]}
                </button>
              </li>
            ))}
          </ul>
        </ShellCard>
      )}

      {tab === 'about' && (
        <ShellCard title="About">
          <p className="text-sm font-semibold leading-relaxed">
            All 118 elements with their atomic masses, groups, periods, states at room temperature
            and electron configurations.
          </p>
          <p className="mt-2 text-sm font-semibold leading-relaxed" style={{ color: 'var(--shell-muted)' }}>
            Masses in [brackets] have no stable isotope — the number is the mass of the longest-lived
            one. The f-block is lifted out below the main table, the way school charts print it.
          </p>
        </ShellCard>
      )}
    </>
  )

  return (
    <ToolShell
      title="Periodic Table"
      subtitle="All 118 elements, searchable"
      icon={IconAtom}
      version="Periodic Table v1.0"
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      sidebar={sidebar}
      onClose={onClose}
    >
      <div className="scroll-slim overflow-x-auto pb-2">
        <div
          className="grid min-w-[58rem] gap-[3px]"
          style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))', gridTemplateRows: 'repeat(7, auto) 1rem repeat(2, auto)' }}
        >
          {/* Markers pointing at where the f-block belongs in the main grid. */}
          <span className="col-start-3 row-start-6 grid place-items-center text-[10px] font-extrabold text-ember">57-71→</span>
          <span className="col-start-3 row-start-7 grid place-items-center text-[10px] font-extrabold text-ember">89-103→</span>

          {ELEMENTS.map((el) => {
            const { column, row } = gridPosition(el)
            const gridRow = row >= 8 ? row + 1 : row
            const dimmed =
              (matches !== null && !matches.has(el.z)) ||
              (highlight !== null && el.category !== highlight)

            return (
              <button
                key={el.z}
                type="button"
                onClick={() => setSelected(el)}
                style={{ gridColumn: column, gridRow }}
                aria-label={`${el.name}, atomic number ${el.z}`}
                className={clsx(
                  'aspect-square rounded-md px-0.5 py-1 text-center transition hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
                  CATEGORY_STYLES[el.category],
                  dimmed && 'opacity-20',
                  selected?.z === el.z && 'ring-2 ring-ember ring-offset-1',
                )}
              >
                <span className="block text-[8px] font-bold leading-none opacity-60">{el.z}</span>
                <span className="block text-[15px] font-extrabold leading-tight">{el.symbol}</span>
                <span className="block truncate text-[6px] font-bold leading-none opacity-60">{el.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div
        className="mt-4 rounded-2xl px-4 py-3 text-center text-sm font-bold"
        style={{ background: 'var(--shell-panel)', border: '1px solid var(--shell-line)', color: 'var(--shell-muted)' }}
      >
        {selected ? (
          <span>
            <strong style={{ color: 'var(--shell-text)' }}>{selected.name}</strong> · {selected.symbol} ·{' '}
            {CATEGORY_LABELS[selected.category]} · {selected.mass} · {STATE_LABELS[selected.state]} ·{' '}
            <span className="font-mono">{selected.config}</span>
          </span>
        ) : (
          'Click any element to see its details'
        )}
      </div>
    </ToolShell>
  )
}

function ElementDetail({ el }: { el: ChemElement }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className={clsx('grid size-14 shrink-0 place-items-center rounded-xl', CATEGORY_STYLES[el.category])}>
          <span className="text-xl font-extrabold leading-none">{el.symbol}</span>
          <span className="text-[10px] font-bold opacity-70">{el.z}</span>
        </div>
        <div className="min-w-0">
          <p className="truncate font-extrabold">{el.name}</p>
          <p className="text-xs font-bold" style={{ color: 'var(--shell-muted)' }}>
            {CATEGORY_LABELS[el.category]}
          </p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {[
          ['Mass', el.mass],
          ['Group', el.group === 0 ? '—' : String(el.group)],
          ['Period', String(el.period)],
          ['State', STATE_LABELS[el.state]],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--shell-muted)' }}>
              {k}
            </dt>
            <dd className="font-mono text-sm font-bold">{v}</dd>
          </div>
        ))}
        <div className="col-span-2">
          <dt className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--shell-muted)' }}>
            Configuration
          </dt>
          <dd className="font-mono text-sm font-bold">{el.config}</dd>
        </div>
      </dl>
    </div>
  )
}
