import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/session'

export const metadata = {
  title: 'Courses — PaperPath',
  description: 'Every class and subject on PaperPath, with what each one covers.',
}

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

/**
 * Public course catalog.
 *
 * Deliberately readable while signed out — this is the page that has to sell
 * the product, so it must not sit behind the auth gate. `/academic` is the
 * chapter browser for the class you are studying; this is the storefront for
 * everything on offer.
 */
export default async function CoursesPage() {
  const [user, classes] = await Promise.all([
    currentUser(),
    prisma.classLevel.findMany({
      orderBy: { sortKey: 'asc' },
      include: {
        board: true,
        courses: {
          orderBy: { sortKey: 'asc' },
          include: {
            subject: true,
            chapters: { select: { _count: { select: { topics: true } } } },
          },
        },
      },
    }),
  ])

  const totals = classes.reduce(
    (acc, c) => {
      for (const course of c.courses) {
        acc.courses += 1
        acc.chapters += course.chapters.length
        acc.topics += course.chapters.reduce((n, ch) => n + ch._count.topics, 0)
      }
      return acc
    },
    { courses: 0, chapters: 0, topics: 0 },
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold text-navy-deep">Courses</h1>
        <p className="mt-1 font-semibold text-navy/50">
          {totals.courses} courses across {classes.length} classes — {totals.chapters} chapters and{' '}
          {totals.topics} lessons.
        </p>
      </header>

      <div className="space-y-4">
        {classes.map((classLevel) => {
          const chapters = classLevel.courses.reduce((n, c) => n + c.chapters.length, 0)
          const topics = classLevel.courses.reduce(
            (n, c) => n + c.chapters.reduce((m, ch) => m + ch._count.topics, 0),
            0,
          )
          const empty = chapters === 0

          return (
            <section key={classLevel.id} className="rounded-3xl card-surface p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-xl font-extrabold text-navy-deep">{classLevel.label}</h2>
                <span className="text-xs font-bold uppercase tracking-wide text-navy/40">
                  {classLevel.board.code}
                </span>
                {!empty && (
                  <span className="text-sm font-semibold text-navy/45">
                    {chapters} chapters · {topics} lessons
                  </span>
                )}
                {classLevel.bundlePricePaise && (
                  <span className="ml-auto flex items-baseline gap-2">
                    {classLevel.bundleListPricePaise && (
                      <span className="text-sm font-semibold text-navy/35 line-through">
                        {rupees(classLevel.bundleListPricePaise)}
                      </span>
                    )}
                    <span className="text-lg font-extrabold text-ember">
                      {rupees(classLevel.bundlePricePaise)}
                    </span>
                    <span className="text-xs font-bold text-navy/40">for the whole class</span>
                  </span>
                )}
              </div>

              {empty ? (
                <p className="mt-3 rounded-2xl bg-navy/4 px-4 py-5 text-center text-sm font-semibold text-navy/40">
                  Chapters for this class are still being written.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {classLevel.courses.map((course) => {
                    const courseTopics = course.chapters.reduce((n, ch) => n + ch._count.topics, 0)
                    return (
                      <li key={course.id}>
                        <Link
                          href={`/academic?class=${classLevel.slug}&subject=${course.subject.slug}`}
                          className="flex h-full flex-col rounded-2xl border border-navy/10 bg-surface p-4 transition hover:-translate-y-0.5 hover:border-amber motion-reduce:hover:translate-y-0"
                        >
                          <span className="flex items-center gap-2.5">
                            <span
                              aria-hidden
                              className="size-8 shrink-0 rounded-lg"
                              style={{
                                background: `linear-gradient(135deg, ${course.subject.colorFrom}, ${course.subject.colorTo})`,
                              }}
                            />
                            <span className="font-extrabold text-navy-deep">
                              {course.subject.name}
                            </span>
                          </span>
                          <span className="mt-2 text-sm font-semibold text-navy/50">
                            {course.chapters.length} chapters · {courseTopics} lessons
                          </span>
                          <span className="mt-3 flex items-baseline justify-between">
                            {/* A course still on the schema's default price
                                would advertise "₹0" and then be refused at
                                checkout for having no price set. Say nothing
                                rather than quote a price that isn't one. */}
                            {course.pricePaise > 0 ? (
                              <span className="font-extrabold text-navy-deep">
                                {rupees(course.pricePaise)}
                              </span>
                            ) : (
                              <span className="text-sm font-semibold text-navy/40">
                                Price coming soon
                              </span>
                            )}
                            <span className="text-xs font-bold text-ember">Browse →</span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}

              {!empty && classLevel.bundlePricePaise && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/academic?class=${classLevel.slug}`}
                    className="rounded-full border border-navy/15 bg-surface px-5 py-2.5 text-sm font-extrabold text-navy-deep transition hover:border-amber"
                  >
                    Browse chapters
                  </Link>
                  <Link
                    href={
                      user
                        ? `/checkout?class=${classLevel.slug}`
                        : `/login?next=${encodeURIComponent(`/checkout?class=${classLevel.slug}`)}`
                    }
                    className="rounded-full flame-gradient px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105"
                  >
                    Get the bundle
                  </Link>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
