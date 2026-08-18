'use client'

/**
 * The whole client-side surface of the receipt: one call to the browser's own
 * print dialogue, which is also how it becomes a PDF. No PDF library — that is
 * megabytes of dependency and a rendering engine to keep patched, for something
 * every browser already does correctly.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl border border-navy/15 bg-surface px-4 py-2 text-sm font-extrabold text-navy/65 transition hover:border-amber"
    >
      Print or save as PDF
    </button>
  )
}
