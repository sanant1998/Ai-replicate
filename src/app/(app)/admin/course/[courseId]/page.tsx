import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isStaff } from '@/lib/admin'
import { Forbidden } from '../../Forbidden'
import { ChapterEditor } from './ChapterEditor'
import { deleteChapter } from '../../actions'

export default async function AdminCoursePage(props: PageProps<'/admin/course/[courseId]'>) {
  if (!(await isStaff())) return <Forbidden />
  const { courseId } = await props.params

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      subject: true,
      classLevel: true,
      chapters: {
        orderBy: { index: 'asc' },
        include: { _count: { select: { topics: true, questions: true } } },
      },
    },
  })
  if (!course) notFound()

  const nextIndex = (course.chapters.at(-1)?.index ?? 0) + 1

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/admin" className="text-sm font-bold text-navy/45 hover:text-ember">
          ← All courses
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold text-navy-deep">
          {course.subject.name} · {course.classLevel.label}
        </h1>
      </div>

      <section className="rounded-3xl card-surface divide-y divide-navy/8">
        <p className="px-6 py-3 text-sm font-extrabold tracking-wider text-navy/45">CHAPTERS</p>
        {course.chapters.length === 0 ? (
          <p className="px-6 py-4 text-sm font-semibold text-navy/40">No chapters yet.</p>
        ) : (
          course.chapters.map((ch) => (
            <div key={ch.id} className="flex items-center justify-between gap-3 px-6 py-4">
              <Link href={`/admin/chapter/${ch.id}`} className="min-w-0 hover:text-ember">
                <span className="block truncate font-bold text-navy-deep">
                  {ch.index}. {ch.title}
                  {ch.isFree && (
                    <span className="ml-2 rounded-lg bg-moss/15 px-1.5 py-0.5 text-xs font-extrabold text-moss">
                      FREE
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold text-navy/45">
                  {ch._count.topics} topics · {ch._count.questions} questions
                </span>
              </Link>
              <form action={deleteChapter}>
                <input type="hidden" name="id" value={ch.id} />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl border border-navy/15 px-3 py-1.5 text-sm font-bold text-navy/50 transition hover:border-ember hover:text-ember"
                >
                  Delete
                </button>
              </form>
            </div>
          ))
        )}
      </section>

      <ChapterEditor courseId={course.id} nextIndex={nextIndex} />
    </div>
  )
}
