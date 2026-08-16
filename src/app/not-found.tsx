import Link from 'next/link'

export const metadata = { title: 'Page not found — PaperPath' }

/**
 * Reached both by a bad URL and by any page calling `notFound()` — a deleted
 * chapter, a topic id that no longer resolves. The links matter more than the
 * message: whatever the student was trying to reach is gone, so the page's job
 * is to put them back somewhere useful rather than to explain HTTP.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-8 text-center">
      <p className="text-5xl font-extrabold text-navy/20">404</p>
      <h1 className="mt-3 text-2xl font-extrabold text-navy-deep">We could not find that page</h1>
      <p className="mt-2 font-semibold text-navy/55">
        The link may be out of date, or the chapter may have been moved.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/academic"
          className="min-h-11 rounded-full flame-gradient px-7 py-3 font-extrabold text-white"
        >
          Browse courses
        </Link>
        <Link
          href="/"
          className="min-h-11 rounded-full border border-navy/15 bg-white px-7 py-3 font-extrabold text-navy/65 transition hover:border-amber"
        >
          Home
        </Link>
      </div>
    </main>
  )
}
