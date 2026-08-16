'use client'

import Link from 'next/link'

/**
 * Catches anything a route segment throws at render.
 *
 * Without this file Next falls back to its own minimal screen, which in a
 * production build is the words "Application error: a client-side exception has
 * occurred" on a white page — no way back, and nothing that tells a
 * fourteen-year-old their homework is not lost.
 *
 * `reset()` re-renders the segment, which is worth offering because most of
 * what fails here is a transient database read rather than a broken page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto max-w-md rounded-3xl card-surface px-8 py-12 text-center">
      <h1 className="text-2xl font-extrabold text-navy-deep">Something went wrong</h1>
      <p className="mt-2 font-semibold text-navy/55">
        This page did not load. Nothing you had saved has been lost.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-full flame-gradient px-7 py-3 font-extrabold text-white"
        >
          Try again
        </button>
        <Link
          href="/academic"
          className="min-h-11 rounded-full border border-navy/15 bg-white px-7 py-3 font-extrabold text-navy/65 transition hover:border-amber"
        >
          Back to courses
        </Link>
      </div>

      {/* The digest is the only handle on the server-side stack, which is not
          sent to the browser. Showing it gives a student something to quote to
          support instead of "it broke". */}
      {error.digest && (
        <p className="mt-6 text-xs font-semibold text-navy/35">Reference: {error.digest}</p>
      )}
    </div>
  )
}
