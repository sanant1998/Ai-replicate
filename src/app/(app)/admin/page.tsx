import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'
import { Forbidden } from './Forbidden'

export default async function AdminPage() {
  if (!(await isAdmin())) return <Forbidden />

  const classes = await prisma.classLevel.findMany({
    orderBy: { sortKey: 'asc' },
    include: {
      board: true,
      courses: {
        orderBy: { sortKey: 'asc' },
        include: {
          subject: true,
          _count: { select: { chapters: true } },
        },
      },
    },
  })

  const totals = {
    chapters: await prisma.chapter.count(),
    topics: await prisma.topic.count(),
    questions: await prisma.question.count(),
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold text-navy-deep">Content admin</h1>
        <p className="mt-1 font-semibold text-navy/50">
          {totals.chapters} chapters · {totals.topics} topics · {totals.questions} questions
        </p>
      </div>

      {classes.map((cl) => (
        <section key={cl.id} className="rounded-3xl card-surface divide-y divide-navy/8">
          <p className="px-6 py-3 text-sm font-extrabold tracking-wider text-navy/45">
            {cl.board.code} · {cl.label.toUpperCase()}
          </p>
          {cl.courses.length === 0 ? (
            <p className="px-6 py-4 text-sm font-semibold text-navy/40">No courses.</p>
          ) : (
            cl.courses.map((c) => (
              <Link
                key={c.id}
                href={`/admin/course/${c.id}`}
                className="flex items-center justify-between px-6 py-4 transition hover:bg-navy/4"
              >
                <span className="font-bold text-navy-deep">{c.subject.name}</span>
                <span className="text-sm font-semibold text-navy/45">
                  {c._count.chapters} chapters →
                </span>
              </Link>
            ))
          )}
        </section>
      ))}
    </div>
  )
}
