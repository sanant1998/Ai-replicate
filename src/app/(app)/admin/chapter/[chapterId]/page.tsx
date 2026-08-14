import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'
import { formatDuration } from '@/lib/format'
import { Forbidden } from '../../Forbidden'
import { QuestionEditor, TopicEditor } from './Editors'
import { deleteQuestion, deleteTopic } from '../../actions'

export default async function AdminChapterPage(props: PageProps<'/admin/chapter/[chapterId]'>) {
  if (!(await isAdmin())) return <Forbidden />
  const { chapterId } = await props.params

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      course: { include: { subject: true, classLevel: true } },
      topics: { orderBy: { index: 'asc' } },
      questions: { orderBy: { index: 'asc' } },
    },
  })
  if (!chapter) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href={`/admin/course/${chapter.courseId}`}
          className="text-sm font-bold text-navy/45 hover:text-ember"
        >
          ← {chapter.course.subject.name} · {chapter.course.classLevel.label}
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold text-navy-deep">
          {chapter.index}. {chapter.title}
        </h1>
      </div>

      {/* ------------------------------------------------------------- topics */}
      <section className="rounded-3xl card-surface divide-y divide-navy/8">
        <p className="px-6 py-3 text-sm font-extrabold tracking-wider text-navy/45">TOPICS</p>
        {chapter.topics.length === 0 ? (
          <p className="px-6 py-4 text-sm font-semibold text-navy/40">No topics yet.</p>
        ) : (
          chapter.topics.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-6 py-4">
              <span className="min-w-0">
                <span className="block truncate font-bold text-navy-deep">
                  {t.index}. {t.title}
                </span>
                <span className="text-sm font-semibold text-navy/45">
                  {t.durationSec > 0 ? formatDuration(t.durationSec) : 'no runtime'} ·{' '}
                  {t.videoUrl ? (
                    <span className="text-moss">video set</span>
                  ) : (
                    <span className="text-amber">in production</span>
                  )}
                </span>
              </span>
              <form action={deleteTopic}>
                <input type="hidden" name="id" value={t.id} />
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

      <TopicEditor
        chapterId={chapter.id}
        nextIndex={(chapter.topics.at(-1)?.index ?? 0) + 1}
      />

      {/* ---------------------------------------------------------- questions */}
      <section className="rounded-3xl card-surface divide-y divide-navy/8">
        <p className="px-6 py-3 text-sm font-extrabold tracking-wider text-navy/45">
          QUIZ QUESTIONS
        </p>
        {chapter.questions.length === 0 ? (
          <p className="px-6 py-4 text-sm font-semibold text-navy/40">
            No questions yet — this chapter shows no quiz link to students.
          </p>
        ) : (
          chapter.questions.map((q) => (
            <div key={q.id} className="flex items-start justify-between gap-3 px-6 py-4">
              <span className="min-w-0">
                <span className="block font-bold text-navy-deep">
                  {q.index}. {q.prompt}
                </span>
                <span className="text-sm font-semibold text-navy/45">
                  {q.kind} · {q.marks} mark{q.marks === 1 ? '' : 's'} · answer:{' '}
                  <span className="text-moss">
                    {q.kind === 'MCQ' ? (q.options[Number(q.answer)] ?? q.answer) : q.answer}
                  </span>
                </span>
              </span>
              <form action={deleteQuestion}>
                <input type="hidden" name="id" value={q.id} />
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

      <QuestionEditor
        chapterId={chapter.id}
        nextIndex={(chapter.questions.at(-1)?.index ?? 0) + 1}
      />
    </div>
  )
}
