'use client'

import { useState, type ComponentType, type ReactNode } from 'react'
import { ScientificCalculator } from './tools/ScientificCalculator'
import { GraphingCalculator } from './tools/GraphingCalculator'
import { MatrixCalculator } from './tools/MatrixCalculator'
import { PeriodicTable } from './tools/PeriodicTable'
import { ScienceTextEditor } from './tools/ScienceTextEditor'
import { KetcherEditor } from './tools/KetcherEditor'
import { PracticeGenerator, type Chapter } from './tools/PracticeGenerator'

type ToolId = 'practice' | 'editor' | 'graphing' | 'scientific' | 'ketcher' | 'periodic' | 'matrix'

type Tool = {
  id: ToolId
  name: string
  blurb: string
  icon: ReactNode
  Panel: ComponentType<{ onClose: () => void }>
  /**
   * Whether the tool talks to the server. Every other tool runs wholly in the
   * browser and costs nothing, which this page says out loud — so the one that
   * spends a credit has to be labelled rather than quietly counted among them.
   */
  online?: boolean
}

/* Inline icons rather than an icon package: six glyphs do not justify a
   dependency, and these inherit currentColor with the rest of the UI. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const IconDocument = (
  <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
)

const IconGraph = (
  <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
    <path d="M4 4v16h16" />
    <path d="M7 15c2.5 0 3-8 5.5-8S16 13 19 13" />
  </svg>
)

const IconCalculator = (
  <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h4M8 18h.01M12 18h.01" />
  </svg>
)

const IconMolecule = (
  <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="5" cy="7" r="1.8" />
    <circle cx="19" cy="7" r="1.8" />
    <circle cx="12" cy="20" r="1.8" />
    <path d="M10.2 10.4 6.6 8.2M13.8 10.4l3.6-2.2M12 14.5V18" />
  </svg>
)

const IconTable = (
  <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M9 4v16M15 10v10" />
  </svg>
)

const IconMatrix = (
  <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
    <path d="M7 4H5v16h2M17 4h2v16h-2" />
    <path d="M9.5 9h.01M14 9h.01M9.5 14h.01M14 14h.01" />
  </svg>
)

const IconPractice = (
  <svg viewBox="0 0 24 24" className="size-5" {...stroke}>
    <path d="M9 4h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z" />
    <path d="M9 12h6M9 16h4M12 4v4h4" />
  </svg>
)

const TOOLS: Tool[] = [
  {
    id: 'practice',
    name: 'Practice Generator',
    blurb: 'Fresh questions on any chapter, with the working.',
    icon: IconPractice,
    Panel: PracticeGenerator,
    online: true,
  },
  {
    id: 'editor',
    name: 'Science Text Editor',
    blurb: 'Write notes with equations, then see them typeset as you go.',
    icon: IconDocument,
    Panel: ScienceTextEditor,
  },
  {
    id: 'graphing',
    name: 'Graphing Calculator',
    blurb: 'Plot several functions at once, then pan and zoom around them.',
    icon: IconGraph,
    Panel: GraphingCalculator,
  },
  {
    id: 'scientific',
    name: 'Scientific Calculator',
    blurb: 'Trigonometry, logs, powers and factorials, with a running history.',
    icon: IconCalculator,
    Panel: ScientificCalculator,
  },
  {
    id: 'ketcher',
    name: 'Ketcher Editor',
    blurb: 'Draw chemical structures and read them back as SMILES.',
    icon: IconMolecule,
    Panel: KetcherEditor,
  },
  {
    id: 'periodic',
    name: 'Periodic Table',
    blurb: 'All 118 elements, searchable, with masses and configurations.',
    icon: IconTable,
    Panel: PeriodicTable,
  },
  {
    id: 'matrix',
    name: 'Matrix Calculator',
    blurb: 'Add, multiply, transpose, invert — plus determinant and rank.',
    icon: IconMatrix,
    Panel: MatrixCalculator,
  },
]

export function ToolsWorkspace({ chapters = [] }: { chapters?: Chapter[] }) {
  const [openId, setOpenId] = useState<ToolId | null>(null)
  const open = TOOLS.find((t) => t.id === openId) ?? null

  // Each tool renders its own full-screen ToolShell, so the gallery stays
  // mounted underneath and reopening is instant. Keyed so switching tools
  // mounts a fresh panel rather than reusing another tool's state.
  const OpenPanel = open?.Panel

  return (
    <div className="space-y-5">
      {/* `inert` while a tool is open: the gallery stays mounted so reopening is
          instant, but it must not be clickable, focusable, or read out from
          behind the modal. */}
      <div className="space-y-5" inert={Boolean(open)}>
      <div>
        <h1 className="text-3xl font-extrabold text-navy-deep">Tools</h1>
        <p className="mt-1 font-semibold text-navy/50">
          {TOOLS.length} tools. All but the practice generator run entirely in your browser and cost
          nothing.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => setOpenId(tool.id)}
            className="group flex items-start gap-3 rounded-2xl card-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-amber motion-reduce:hover:translate-y-0"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-navy/8 text-navy-deep transition group-hover:flame-gradient group-hover:text-white">
              {tool.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-extrabold text-navy-deep">
                {tool.name}
                {tool.online && (
                  <span className="ml-2 rounded-full bg-amber/20 px-2 py-0.5 align-middle text-[11px] font-extrabold uppercase tracking-wide text-navy-deep">
                    1 credit
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-navy/50">{tool.blurb}</span>
            </span>
          </button>
        ))}
      </div>
      </div>

      {/* The practice panel is the one tool that needs data from the server, so
          it is rendered directly rather than through the generic Panel slot. */}
      {open?.id === 'practice' ? (
        <PracticeGenerator key="practice" chapters={chapters} onClose={() => setOpenId(null)} />
      ) : (
        OpenPanel && open && <OpenPanel key={open.id} onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}
