import Link from 'next/link'
import { notFound } from 'next/navigation'
import clsx from 'clsx'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'
import { canAccessChapter, getEntitlements } from '@/lib/access'
import { QuizRunner } from './QuizRunner'
import { retakeQuiz } from './actions'
import { IconCheck, IconLock } from '@/components/icons'

export default async function QuizPage(props: PageProps<'/quiz/[chapterId]'>) {
  const { chapterId } = await props.params
  const session = await readSession()

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { course: { include: { subject: true, classLevel: true } } },
  })
  if (!chapter) notFound()

  if (!session) {
    return (
      <Gate title="Sign in to take this quiz" body="Quizzes are scored and saved to your progress." />
    )
  }

  const ent = await getEntitlements(session.uid)
  if (!canAccessChapter(chapter, chapter.course, ent)) {
    return (
      <Gate
        locked
        title="This chapter is locked"
        body={`Unlock ${chapter.course.subject.name} to take its quizzes.`}
        href={`/checkout?course=${chapter.courseId}`}
      />
    )
  }

  // Questions are fetched without `answer` — the marking key never leaves the server.
  const questions = await prisma.question.findMany({
    where: { chapterId },
    orderBy: { index: 'asc' },
    select: { id: true, index: true, kind: true, prompt: true, options: true, marks: true },
  })

  const latest = await prisma.quizAttempt.findFirst({
    where: { userId: session.uid, chapterId },
    orderBy: { startedAt: 'desc' },
    include: { answers: true },
  })

  const history = await prisma.quizAttempt.findMany({
    where: { userId: session.uid, chapterId, submittedAt: { not: null } },
    orderBy: { submittedAt: 'desc' },
    take: 5,
  })

  // A submitted attempt shows its result, with the explanations now revealed.
  if (latest?.submittedAt) {
    const withKey = await prisma.question.findMany({
      where: { chapterId },
      orderBy: { index: 'asc' },
    })
    const byQuestion = new Map(latest.answers.map((a) => [a.questionId, a]))
    const pct = latest.maxScore ? Math.round((latest.score / latest.maxScore) * 100) : 0

    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Header chapter={chapter} />

        <div className="rounded-3xl card-surface px-8 py-7 text-center">
          <p className="text-sm font-extrabold tracking-wider text-navy/45">YOUR SCORE</p>
          <p className="mt-1 text-5xl font-extrabold text-navy-deep">
            {latest.score}
            <span className="text-2xl text-navy/35"> / {latest.maxScore}</span>
          </p>
          <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-navy/10">
            <div className="h-full rounded-full flame-gradient" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm font-bold text-navy/50">
            {pct >= 80
              ? 'Strong — you know this chapter.'
              : pct >= 50
                ? 'Getting there. Look at what you missed below.'
                : 'Worth rewatching the chapter, then trying again.'}
          </p>

          <form action={retakeQuiz} className="mt-5">
            <input type="hidden" name="chapterId" value={chapterId} />
            <button
              type="submit"
              className="rounded-2xl flame-gradient px-6 py-2.5 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105"
            >
              Try again
            </button>
          </form>
        </div>

        <ol className="space-y-3">
          {withKey.map((q) => {
            const a = byQuestion.get(q.id)
            // An unanswered question stores '', and Number('') is 0 — reading
            // options[0] would show the student the first option as though they
            // had picked it. Only treat the stored value as an index when there
            // is one.
            const chosen = a?.given.trim() ? Number(a.given) : NaN
            const yours = q.kind === 'MCQ' ? (q.options[chosen] ?? '—') : (a?.given || '—')
            const right = q.kind === 'MCQ' ? (q.options[Number(q.answer)] ?? q.answer) : q.answer

            return (
              <li key={q.id} className="rounded-3xl card-surface px-6 py-5">
                <div className="flex items-start gap-3">
                  <span
                    className={clsx(
                      'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white',
                      a?.correct ? 'bg-moss' : 'bg-ember',
                    )}
                  >
                    {a?.correct ? <IconCheck className="size-3.5" /> : '×'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-navy-deep">
                      {q.index}. {q.prompt}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-navy/60">
                      Your answer: <span className="text-navy-deep">{yours}</span>
                    </p>
                    {!a?.correct && (
                      <p className="text-sm font-semibold text-navy/60">
                        Correct answer: <span className="text-moss">{right}</span>
                      </p>
                    )}
                    {q.explanation && (
                      <p className="mt-2 rounded-xl bg-navy/5 px-3 py-2 text-sm font-semibold text-navy/65">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        {history.length > 1 && (
          <div className="rounded-3xl card-surface px-6 py-5">
            <p className="text-sm font-extrabold tracking-wider text-navy/45">PAST ATTEMPTS</p>
            <ul className="mt-2 space-y-1">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between text-sm font-semibold text-navy/60">
                  <span>{h.submittedAt?.toLocaleString('en-IN')}</span>
                  <span className="font-bold text-navy-deep">
                    {h.score} / {h.maxScore}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Header chapter={chapter} />
      <QuizRunner
        chapterId={chapterId}
        attemptId={latest?.id}
        questions={questions}
        hasQuestions={questions.length > 0}
      />
    </div>
  )
}

function Header({
  chapter,
}: {
  chapter: {
    index: number
    title: string
    course: { subject: { name: string }; classLevel: { slug: string; label: string } }
  }
}) {
  return (
    <header className="rounded-3xl card-surface px-8 py-6">
      <p className="text-sm font-bold text-navy/45">
        <Link
          href={`/academic?class=${chapter.course.classLevel.slug}`}
          className="hover:text-ember"
        >
          {chapter.course.classLevel.label}
        </Link>{' '}
        · {chapter.course.subject.name}
      </p>
      <h1 className="mt-1 text-2xl font-extrabold text-navy-deep">
        Chapter {chapter.index}: {chapter.title}
      </h1>
    </header>
  )
}

function Gate({
  title,
  body,
  href = '/login',
  locked,
}: {
  title: string
  body: string
  href?: string
  locked?: boolean
}) {
  return (
    <div className="mx-auto max-w-lg rounded-3xl card-surface px-8 py-12 text-center">
      {locked && <IconLock className="mx-auto size-10 text-navy/30" />}
      <h1 className="mt-4 text-2xl font-extrabold text-navy-deep">{title}</h1>
      <p className="mt-2 font-semibold text-navy/55">{body}</p>
      <Link
        href={href}
        className="mt-6 inline-block rounded-full flame-gradient px-7 py-3 font-extrabold text-white shadow-lg shadow-ember/25"
      >
        {locked ? 'See plans' : 'Sign in'}
      </Link>
    </div>
  )
}
