'use client'

import dynamic from 'next/dynamic'

/**
 * Ketcher ships several megabytes of JavaScript plus a WebAssembly chemistry
 * engine, and it touches `window` at module scope. Loading it lazily and with
 * ssr:false keeps all of that out of the server render and out of every other
 * page's bundle — it arrives only when a student opens this one tool.
 */
const KetcherCanvas = dynamic(() => import('./KetcherCanvas'), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 grid place-items-center"
      style={{ background: '#f3e2c9' }}
    >
      <div className="text-center">
        <div
          aria-hidden
          className="mx-auto size-8 animate-spin rounded-full border-3 border-navy/15 border-t-ember motion-reduce:animate-none"
        />
        <p className="mt-3 text-sm font-bold text-navy/60">Loading the structure editor…</p>
        <p className="mt-1 text-xs font-semibold text-navy/40">
          The chemistry engine runs in your browser, so the first load takes a moment.
        </p>
      </div>
    </div>
  ),
})

export function KetcherEditor({ onClose }: { onClose: () => void }) {
  return <KetcherCanvas onClose={onClose} />
}
