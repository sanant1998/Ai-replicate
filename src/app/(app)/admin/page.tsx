import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/session'
import { Forbidden } from './Forbidden'
import { AddCourse, DeleteCourse } from './CatalogEditors'

/**
 * Staff home. Teachers and admins both land here; the catalog and people links
 * appear only for admins, and the pages themselves re-check the role rather
 * than trusting that the link was hidden.
 */
export default async function AdminPage() {
  const me = await currentUser()
  if (!me || (me.role !== 'ADMIN' && me.role !== 'TEACHER')) return <Forbidden />
  const admin = me.role === 'ADMIN'

  const [classes, subjects, totals] = await Promise.all([
    prisma.classLevel.findMany({
      orderBy: { sortKey: 'asc' },
      include: {
        board: true,
        courses: {
          orderBy: { sortKey: 'asc' },
          include: {
            subject: true,
            _count: { select: { chapters: true, subscriptions: true } },
          },
        },
      },
    }),
    prisma.subject.findMany({ orderBy: { sortKey: 'asc' } }),
    Promise.all([
      prisma.chapter.count(),
      prisma.topic.count(),
      prisma.question.count(),
      prisma.course.count(),
    ]).then(([chapters, topics, questions, courses]) => ({ chapters, topics, questions, courses })),
  ])

  const classOptions = classes.map((c) => ({ id: c.id, label: c.label }))
  const subjectOptions = subjects.map((s) => ({ id: s.id, label: s.name }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-deep">
            {admin ? 'Content admin' : 'Teacher desk'}
          </h1>
          <p className="mt-1 font-semibold text-navy/50">
            {totals.courses} courses · {totals.chapters} chapters · {totals.topics} lessons ·{' '}
            {totals.questions} exam questions
          </p>
        </div>
        {admin && (
          <div className="flex gap-2">
            <Link
              href="/admin/catalog"
              className="min-h-10 rounded-xl border border-navy/15 bg-surface px-4 py-2 text-sm font-extrabold text-navy/65 transition hover:border-amber"
            >
              Classes &amp; subjects
            </Link>
            <Link
              href="/admin/people"
              className="min-h-10 rounded-xl border border-navy/15 bg-surface px-4 py-2 text-sm font-extrabold text-navy/65 transition hover:border-amber"
            >
              People &amp; roles
            </Link>
            <Link
              href="/admin/payments"
              className="min-h-10 rounded-xl border border-navy/15 bg-surface px-4 py-2 text-sm font-extrabold text-navy/65 transition hover:border-amber"
            >
              Payments &amp; refunds
            </Link>
          </div>
        )}
      </div>

      <div className="rounded-3xl card-surface p-4">
        <h2 className="mb-3 text-sm font-extrabold tracking-wider text-navy/45">ADD A COURSE</h2>
        {classes.length === 0 || subjects.length === 0 ? (
          <p className="text-sm font-semibold text-navy/45">
            {admin ? (
              <>
                Create a class and a subject first in{' '}
                <Link href="/admin/catalog" className="font-extrabold text-ember hover:underline">
                  Classes &amp; subjects
                </Link>
                .
              </>
            ) : (
              'No classes or subjects exist yet — ask an admin to create them.'
            )}
          </p>
        ) : (
          <AddCourse classes={classOptions} subjects={subjectOptions} />
        )}
      </div>

      {classes.map((cl) => (
        <section key={cl.id} className="rounded-3xl card-surface divide-y divide-navy/8">
          <p className="px-6 py-3 text-sm font-extrabold tracking-wider text-navy/45">
            {cl.board.code} · {cl.label.toUpperCase()}
          </p>
          {cl.courses.length === 0 ? (
            <p className="px-6 py-4 text-sm font-semibold text-navy/40">No courses yet.</p>
          ) : (
            cl.courses.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-6 py-4">
                <Link
                  href={`/admin/course/${c.id}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 transition hover:text-ember"
                >
                  <span className="font-bold text-navy-deep">{c.subject.name}</span>
                  <span className="text-sm font-semibold text-navy/45">
                    {c._count.chapters} chapters →
                  </span>
                </Link>
                <DeleteCourse
                  id={c.id}
                  blocked={
                    c._count.subscriptions > 0
                      ? `${c._count.subscriptions} students have bought this`
                      : null
                  }
                />
              </div>
            ))
          )}
        </section>
      ))}
    </div>
  )
}
