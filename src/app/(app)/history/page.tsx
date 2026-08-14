import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'

export default async function HistoryPage() {
  const session = await readSession()
  if (!session) {
    return (
      <div className="mx-auto max-w-md rounded-3xl card-surface px-8 py-12 text-center">
        <h1 className="text-2xl font-extrabold text-navy-deep">Sign in to see your history</h1>
        <Link href="/login" className="mt-6 inline-block rounded-full flame-gradient px-7 py-3 font-extrabold text-white">
          Sign in
        </Link>
      </div>
    )
  }

  const sessions = await prisma.chatSession.findMany({
    where: { userId: session.uid },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: { chapter: { include: { course: { include: { subject: true } } } }, _count: { select: { messages: true } } },
  })

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold text-navy-deep">History</h1>

      {sessions.length === 0 ? (
        <p className="rounded-3xl card-surface px-6 py-10 text-center font-semibold text-navy/50">
          No tutor sessions yet.{' '}
          <Link href="/tutor" className="font-extrabold text-ember hover:underline">
            Ask your first question →
          </Link>
        </p>
      ) : (
        <ul className="rounded-3xl card-surface divide-y divide-navy/8">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={s.chapterId ? `/tutor?chapter=${s.chapterId}` : '/tutor'}
                className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-navy/4"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold text-navy-deep">{s.title}</span>
                  <span className="text-sm font-semibold text-navy/45">
                    {s.chapter
                      ? `${s.chapter.course.subject.name} · Ch ${s.chapter.index}: ${s.chapter.title}`
                      : 'General questions'}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold text-navy/40">{s._count.messages} messages</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
