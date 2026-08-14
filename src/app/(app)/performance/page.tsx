import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'
import { formatDuration } from '@/lib/format'

export default async function PerformancePage() {
  const session = await readSession()
  if (!session) return <SignedOut />

  const progress = await prisma.progress.findMany({
    where: { userId: session.uid },
    include: {
      topic: { include: { chapter: { include: { course: { include: { subject: true } } } } } },
    },
  })

  const bySubject = new Map<string, { name: string; done: number; watchedSec: number }>()
  for (const p of progress) {
    const s = p.topic.chapter.course.subject
    const row = bySubject.get(s.id) ?? { name: s.name, done: 0, watchedSec: 0 }
    if (p.completed) row.done += 1
    row.watchedSec += p.positionSec
    bySubject.set(s.id, row)
  }

  const totalWatched = progress.reduce((s, p) => s + p.positionSec, 0)
  const completed = progress.filter((p) => p.completed).length

  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: session.uid, submittedAt: { not: null } },
    orderBy: { submittedAt: 'desc' },
    include: {
      chapter: { include: { course: { include: { subject: true } } } },
    },
  })

  // Score the most recent attempt per chapter — a retake replaces, not averages.
  const latestPerChapter = new Map<string, (typeof attempts)[number]>()
  for (const a of attempts) if (!latestPerChapter.has(a.chapterId)) latestPerChapter.set(a.chapterId, a)
  const quizzed = [...latestPerChapter.values()]

  const marks = quizzed.reduce((s, a) => s + a.score, 0)
  const outOf = quizzed.reduce((s, a) => s + a.maxScore, 0)
  const quizPct = outOf ? Math.round((marks / outOf) * 100) : null

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold text-navy-deep">Performance</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Topics completed" value={String(completed)} />
        <Tile label="Topics started" value={String(progress.length)} />
        <Tile label="Time watched" value={formatDuration(totalWatched)} />
        <Tile
          label={quizPct === null ? 'Quizzes taken' : `Quiz average · ${quizzed.length} chapters`}
          value={quizPct === null ? '—' : `${quizPct}%`}
        />
      </div>

      {quizzed.length > 0 && (
        <div className="rounded-3xl card-surface divide-y divide-navy/8">
          <p className="px-6 py-3 text-sm font-extrabold tracking-wider text-navy/45">
            LATEST QUIZ SCORES
          </p>
          {quizzed.map((a) => {
            const pct = a.maxScore ? Math.round((a.score / a.maxScore) * 100) : 0
            return (
              <Link
                key={a.id}
                href={`/quiz/${a.chapterId}`}
                className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-navy/4"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold text-navy-deep">
                    Ch {a.chapter.index}: {a.chapter.title}
                  </span>
                  <span className="text-sm font-semibold text-navy/45">
                    {a.chapter.course.subject.name}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-navy/10 sm:block">
                    <span
                      className="block h-full rounded-full flame-gradient"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-16 text-right font-extrabold text-navy-deep">
                    {a.score}/{a.maxScore}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {bySubject.size === 0 ? (
        <p className="rounded-3xl card-surface px-6 py-10 text-center font-semibold text-navy/50">
          Nothing watched yet.{' '}
          <Link href="/academic" className="font-extrabold text-ember hover:underline">
            Start a free chapter →
          </Link>
        </p>
      ) : (
        <div className="rounded-3xl card-surface divide-y divide-navy/8">
          {[...bySubject.values()].map((row) => (
            <div key={row.name} className="flex items-center justify-between px-6 py-4">
              <span className="font-bold text-navy-deep">{row.name}</span>
              <span className="text-sm font-semibold text-navy/55">
                {row.done} completed · {formatDuration(row.watchedSec)} watched
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl card-surface px-6 py-5">
      <p className="text-3xl font-extrabold text-navy-deep">{value}</p>
      <p className="text-sm font-bold text-navy/45">{label}</p>
    </div>
  )
}

function SignedOut() {
  return (
    <div className="mx-auto max-w-md rounded-3xl card-surface px-8 py-12 text-center">
      <h1 className="text-2xl font-extrabold text-navy-deep">Sign in to see your progress</h1>
      <Link
        href="/login"
        className="mt-6 inline-block rounded-full flame-gradient px-7 py-3 font-extrabold text-white"
      >
        Sign in
      </Link>
    </div>
  )
}
