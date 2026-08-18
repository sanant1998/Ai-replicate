import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isStaff } from '@/lib/admin'
import { Forbidden } from '../../Forbidden'
import { AnswerEditor, MaterialEditor } from './Editors'
import { deleteTopicAnswer } from '../../actions'

export default async function AdminTopicPage(props: PageProps<'/admin/topic/[topicId]'>) {
  if (!(await isStaff())) return <Forbidden />
  const { topicId } = await props.params

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      chapter: { include: { course: { include: { subject: true, classLevel: true } } } },
      answers: { orderBy: { index: 'asc' } },
    },
  })
  if (!topic) notFound()

  const ready = Boolean(topic.content?.trim())

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href={`/admin/chapter/${topic.chapterId}`}
          className="text-sm font-bold text-navy/45 hover:text-ember"
        >
          ← {topic.chapter.course.subject.name} · Ch {topic.chapter.index}: {topic.chapter.title}
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold text-navy-deep">
          {topic.index}. {topic.title}
        </h1>
        <p className="mt-1 text-sm font-semibold text-navy/45">
          {topic.chapter.course.classLevel.label} ·{' '}
          {ready ? (
            <span className="text-moss">live on Guided Practice</span>
          ) : (
            <span className="text-amber">no material yet — not offered</span>
          )}
        </p>
      </div>

      <MaterialEditor topicId={topic.id} content={topic.content ?? ''} />

      <section className="rounded-3xl card-surface divide-y divide-navy/8">
        <p className="px-6 py-3 text-sm font-extrabold tracking-wider text-navy/45">
          EXACT ANSWERS ({topic.answers.length})
        </p>
        {topic.answers.length === 0 ? (
          <p className="px-6 py-4 text-sm font-semibold text-navy/40">
            None yet. Without these the tutor still answers, but from the material in its own
            words rather than from wording you chose.
          </p>
        ) : (
          topic.answers.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 px-6 py-4">
              <span className="min-w-0">
                <span className="block font-bold text-navy-deep">
                  {a.index}. {a.question}
                </span>
                <span className="block text-sm font-semibold text-moss">{a.answer}</span>
                <span className="text-sm font-semibold text-navy/45">
                  {a.steps.length > 0
                    ? `${a.steps.length} written step${a.steps.length === 1 ? '' : 's'}`
                    : 'steps written by the tutor'}
                </span>
              </span>
              <form action={deleteTopicAnswer}>
                <input type="hidden" name="id" value={a.id} />
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

      <AnswerEditor topicId={topic.id} nextIndex={(topic.answers.at(-1)?.index ?? 0) + 1} />
    </div>
  )
}
