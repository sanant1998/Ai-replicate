'use client'

import { useRef, useState } from 'react'
import { Editor } from 'ketcher-react'
import { StandaloneStructServiceProvider } from 'ketcher-standalone'
import type { Ketcher } from 'ketcher-core'
import { ShellCard, ToolShell, type ShellTab } from '../ToolShell'
import 'ketcher-react/dist/index.css'

/**
 * "Standalone" means the whole chemistry engine (Indigo, compiled to WebAssembly)
 * runs in the browser. There is no structure-service backend to deploy, and
 * nothing a student draws leaves their machine.
 */
const structServiceProvider = new StandaloneStructServiceProvider()

const IconMolecule = (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="5" cy="7" r="1.8" />
    <circle cx="19" cy="7" r="1.8" />
    <circle cx="12" cy="20" r="1.8" />
    <path d="M10.2 10.4 6.6 8.2M13.8 10.4l3.6-2.2M12 14.5V18" />
  </svg>
)

const tabIcon = (path: string) => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
)

const TABS: ShellTab[] = [
  { id: 'about', label: 'About', icon: tabIcon('M12 8h.01M11 12h1v4h1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z') },
  { id: 'export', label: 'Export', icon: tabIcon('M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2') },
  { id: 'help', label: 'Help', icon: tabIcon('M12 17h.01M9.1 9a3 3 0 1 1 4 2.8c-.7.3-1.1 1-1.1 1.7M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z') },
]

const FEATURES = ['Draw Structures', 'Bonds & Atoms', 'Templates', 'Export/Save', 'Reactions']
const AUDIENCE = ['🧪 Chemistry', '📄 Homework', '🎯 JEE/NEET', '🔬 Research']

export default function KetcherCanvas({ onClose }: { onClose: () => void }) {
  const ketcherRef = useRef<Ketcher | null>(null)
  // The engine finishes booting well after the toolbar paints, so the button is
  // held disabled until onInit fires. Without this an early click is a no-op
  // with no feedback, which reads as a broken button.
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState('about')
  const [smiles, setSmiles] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function readSmiles() {
    const ketcher = ketcherRef.current
    if (!ketcher) return
    try {
      const value = await ketcher.getSmiles()
      setSmiles(value || '(the canvas is empty)')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the structure')
    }
  }

  const sidebar = (
    <>
      {tab === 'about' && (
        <>
          <ShellCard title="About Ketcher">
            <p className="text-sm font-semibold leading-relaxed">
              Ketcher is a web-based chemical structure editor that lets you draw and edit molecular
              structures. The chemistry engine runs entirely in your browser.
            </p>
          </ShellCard>
          <ShellCard title="✨ Features">
            <ol className="space-y-2">
              {FEATURES.map((f, i) => (
                <li key={f} className="flex items-center gap-2.5 text-sm font-bold">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-navy-solid text-[11px] text-white">
                    {i + 1}
                  </span>
                  {f}
                </li>
              ))}
            </ol>
          </ShellCard>
          <ShellCard title="Perfect for">
            <div className="grid grid-cols-2 gap-2">
              {AUDIENCE.map((a) => (
                <span
                  key={a}
                  className="rounded-lg px-2 py-2 text-center text-xs font-bold"
                  style={{ border: '1px solid var(--shell-line)' }}
                >
                  {a}
                </span>
              ))}
            </div>
          </ShellCard>
        </>
      )}

      {tab === 'export' && (
        <ShellCard title="SMILES">
          <button
            type="button"
            onClick={readSmiles}
            disabled={!ready}
            className="min-h-11 w-full rounded-xl bg-navy-solid text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-45"
          >
            {ready ? 'Get SMILES' : 'Starting the engine…'}
          </button>
          {smiles && (
            // <output> rather than <code>: it is a computed result, and it gives
            // the value a selector that the surrounding prose cannot shadow.
            <output
              aria-live="polite"
              className="scroll-slim mt-3 block max-w-full overflow-x-auto rounded-lg px-2.5 py-2 font-mono text-xs font-bold"
              style={{ background: 'var(--shell-active)' }}
            >
              {smiles}
            </output>
          )}
          <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--shell-muted)' }}>
            SMILES is a plain-text way of writing a structure, e.g. <code className="font-mono">CCO</code>{' '}
            for ethanol.
          </p>
        </ShellCard>
      )}

      {tab === 'help' && (
        <ShellCard title="How to use">
          <ul className="space-y-2 text-sm font-semibold leading-relaxed">
            <li>Pick a bond tool from the left rail, then click and drag on the canvas.</li>
            <li>Click an atom label on the right to place that element.</li>
            <li>Use the ring templates along the bottom for benzene and other cycles.</li>
            <li>PT opens the full periodic table for less common elements.</li>
          </ul>
        </ShellCard>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
          {error}
        </p>
      )}
    </>
  )

  return (
    <ToolShell
      title="Ketcher Editor"
      subtitle="Chemistry Structure Editor"
      icon={IconMolecule}
      version="Ketcher Editor v1.0"
      status={ready ? 'Ready' : 'Loading'}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      sidebar={sidebar}
      onClose={onClose}
    >
      {/* Ketcher measures its container, so the height has to be explicit. */}
      <div
        className="ketcher-frame h-[calc(100dvh-8rem)] min-h-[30rem] overflow-hidden rounded-2xl bg-surface"
        style={{ border: '1px solid var(--shell-line)' }}
      >
        <Editor
          staticResourcesUrl=""
          structServiceProvider={structServiceProvider}
          errorHandler={(message) => setError(String(message))}
          onInit={(ketcher: Ketcher) => {
            ketcherRef.current = ketcher
            setReady(true)
          }}
        />
      </div>
    </ToolShell>
  )
}
