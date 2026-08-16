import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'
import { formatClock } from '@/lib/format'
import { deleteNote, toggleBookmark } from '@/app/(app)/study-actions'

export default async function NotesPage() {
  const session = await readSession()
  // Redirect rather than render a dead end, and come back here after sign-in —
  // the same handling /tutor, /tools and /checkout use.
  if (!session) redirect('/login?next=%2Fnotes')

  const [notes, bookmarks] = await Promise.all([
    prisma.note.findMany({
      where: { userId: session.uid },
      orderBy: { createdAt: 'desc' },
      include: { topic: { include: { chapter: { include: { course: { include: { subject: true } } } } } } },
    }),
    prisma.bookmark.findMany({
      where: { userId: session.uid },
      orderBy: { createdAt: 'desc' },
      include: {
        chapter: {
          include: {
            course: { include: { subject: true } },
            topics: { orderBy: { index: 'asc' }, take: 1, select: { id: true } },
          },
        },
      },
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-3xl font-extrabold text-navy-deep">Notes &amp; saved</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold tracking-wider text-navy/45">SAVED CHAPTERS</h2>
        {bookmarks.length === 0 ? (
          <p className="rounded-3xl card-surface px-6 py-8 text-center font-semibold text-navy/50">
            Nothing saved yet. Hit <strong className="text-navy-deep">☆ Save chapter</strong> while
            watching to keep a chapter here.
          </p>
        ) : (
          <ul className="rounded-3xl card-surface divide-y divide-navy/8">
            {bookmarks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-6 py-4">
                <Link
                  href={b.chapter.topics[0] ? `/learn/${b.chapter.topics[0].id}` : '/academic'}
                  className="min-w-0 hover:text-ember"
                >
                  <span className="block truncate font-bold text-navy-deep">
                    Ch {b.chapter.index}: {b.chapter.title}
                  </span>
                  <span className="text-sm font-semibold text-navy/45">
                    {b.chapter.course.subject.name}
                  </span>
                </Link>
                <form action={toggleBookmark}>
                  <input type="hidden" name="chapterId" value={b.chapterId} />
                  <input type="hidden" name="from" value="/notes" />
                  <button
                    type="submit"
                    className="shrink-0 rounded-xl border border-navy/15 px-3 py-1.5 text-sm font-bold text-navy/55 transition hover:border-ember hover:text-ember"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold tracking-wider text-navy/45">NOTES</h2>
        {notes.length === 0 ? (
          <p className="rounded-3xl card-surface px-6 py-8 text-center font-semibold text-navy/50">
            No notes yet. Write one under any lesson and it will appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-3xl card-surface px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/learn/${n.topicId}`} className="min-w-0 text-sm font-bold text-navy/55 hover:text-ember">
                    {n.topic.chapter.course.subject.name} · Ch {n.topic.chapter.index}:{' '}
                    {n.topic.chapter.title}
                    <span className="ml-2 rounded-lg bg-navy/10 px-1.5 py-0.5 text-xs font-extrabold text-navy/60">
                      {formatClock(n.atSec)}
                    </span>
                  </Link>
                  <form action={deleteNote}>
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      className="shrink-0 text-navy/30 transition hover:text-ember"
                      aria-label="Delete note"
                    >
                      ×
                    </button>
                  </form>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap font-semibold text-navy-deep">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
