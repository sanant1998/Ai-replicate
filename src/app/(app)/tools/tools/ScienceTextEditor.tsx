'use client'

import dynamic from 'next/dynamic'

/**
 * Loaded client-only so the panel can seed itself straight from localStorage.
 * With a server render in play it would have to start from the sample text and
 * swap in the saved draft afterwards, which means a visible flash of the wrong
 * document — and a hydration mismatch if done during render.
 */
const ScienceEditorPanel = dynamic(() => import('./ScienceEditorPanel'), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 grid place-items-center"
      style={{ background: '#f3e2c9' }}
    >
      <p className="text-sm font-bold text-navy/50">Opening the editor…</p>
    </div>
  ),
})

export function ScienceTextEditor({ onClose }: { onClose: () => void }) {
  return <ScienceEditorPanel onClose={onClose} />
}
