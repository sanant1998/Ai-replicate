import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/session'
import { formatDuration } from '@/lib/format'

export const metadata = { title: 'Family — PaperPath', robots: { index: false, follow: false } }

/**
 * What a parent can see, and the boundary of it.
 *
 * Read-only and summarised on purpose. A parent following along has a real
 * interest in whether the lessons are being watched and how the quizzes are
 * going; they do not need the text of what a fourteen-year-old asked the tutor
 * at eleven at night, and giving them that would make the tutor useless as
 * somewhere to admit you do not understand something.
 *
 * So: progress, quiz scores, and how many tutor sessions there have been —
 * never the messages inside them, and never their notes.
 */
export default async function FamilyPage() {
  const user = await currentUser()
  if (!user) redirect('/login?next=%2Ffamily')

  const links = await prisma.parentLink.findMany({
    where: { parentId: user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          dailyCredits: true,
          dailyCreditCap: true,
          classLevel: { select: { label: true } },
          board: { select: { code: true } },
        },
      },
    },
  })

  if (links.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl card-surface px-8 py-12 text-center">
        <h1 className="text-2xl font-extrabold text-navy-deep">No children linked yet</h1>
        <p className="mt-3 font-semibold text-navy/55">
          A child is linked to you when they give your address as their parent or guardian and you
          follow the link we email you. Ask them to add you from their profile page.
        </p>
      </div>
    )
  }

  const children = await Promise.all(
    links.map(async ({ student }) => {
      const [progress, attempts, sessions] = await Promise.all([
        prisma.progress.findMany({
          where: { userId: student.id },
          select: { positionSec: true, completed: true },
        }),
        prisma.quizAttempt.findMany({
          where: { userId: student.id, submittedAt: { not: null } },
          orderBy: { submittedAt: 'desc' },
          take: 200,
          select: { chapterId: true, score: true, maxScore: true, submittedAt: true },
        }),
        prisma.chatSession.count({ where: { userId: student.id } }),
      ])

      // The most recent attempt per chapter — a retake replaces rather than
      // averages, exactly as the student's own Performance page scores it.
      const latest = new Map<string, (typeof attempts)[number]>()
      for (const a of attempts) if (!latest.has(a.chapterId)) latest.set(a.chapterId, a)
      const scored = [...latest.values()]
      const marks = scored.reduce((s, a) => s + a.score, 0)
      const outOf = scored.reduce((s, a) => s + a.maxScore, 0)

      return {
        student,
        watchedSec: progress.reduce((s, p) => s + p.positionSec, 0),
        started: progress.length,
        completed: progress.filter((p) => p.completed).length,
        quizzes: scored.length,
        quizPct: outOf ? Math.round((marks / outOf) * 100) : null,
        lastQuizAt: scored[0]?.submittedAt ?? null,
        sessions,
      }
    }),
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold text-navy-deep">Family</h1>
        <p className="mt-1 font-semibold text-navy/50">
          How your {children.length === 1 ? 'child is' : 'children are'} getting on. Read-only — and
          their tutor conversations and notes stay private to them.
        </p>
      </div>

      {children.map((c) => (
        <section key={c.student.id} className="rounded-3xl card-surface p-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-xl font-extrabold text-navy-deep">{c.student.name}</h2>
            <span className="text-sm font-semibold text-navy/50">{c.student.email}</span>
            {c.student.classLevel && (
              <span className="text-xs font-bold uppercase tracking-wide text-navy/40">
                {c.student.board?.code} · {c.student.classLevel.label}
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Time watched" value={formatDuration(c.watchedSec)} />
            <Tile label="Lessons completed" value={`${c.completed} of ${c.started} started`} />
            <Tile
              label={c.quizPct === null ? 'Quizzes' : `Quiz average · ${c.quizzes} chapters`}
              value={c.quizPct === null ? 'None yet' : `${c.quizPct}%`}
            />
            <Tile
              label="AI tutor"
              value={`${c.sessions} ${c.sessions === 1 ? 'session' : 'sessions'}`}
              sub={`${c.student.dailyCredits}/${c.student.dailyCreditCap} questions left today`}
            />
          </div>

          {c.lastQuizAt && (
            <p className="mt-3 text-sm font-semibold text-navy/45">
              Last quiz submitted {c.lastQuizAt.toLocaleDateString('en-IN')}.
            </p>
          )}
        </section>
      ))}

      <p className="text-sm font-semibold text-navy/45">
        Want a copy of everything we hold about your child, or want it deleted? Both are your right
        under the DPDP Act — see the{' '}
        <Link href="/privacy" className="font-extrabold text-ember hover:underline">
          privacy policy
        </Link>
        .
      </p>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-navy/4 px-4 py-3">
      <p className="text-xs font-extrabold uppercase tracking-wide text-navy/45">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-navy-deep">{value}</p>
      {sub && <p className="text-sm font-semibold text-navy/45">{sub}</p>}
    </div>
  )
}
