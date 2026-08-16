import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/session'
import { formatDuration, formatPaise } from '@/lib/format'
import { LandingAuth } from './LandingAuth'
import {
  IconBook,
  IconCheck,
  IconClock,
  IconList,
  IconPlay,
  IconRobot,
  IconSparkles,
} from '@/components/icons'

export const metadata = {
  title: 'PaperPath — chapter-wise video lessons for CBSE, ICSE & state boards',
  description:
    'Chapter-wise video lectures, an AI tutor that knows the chapter you are on, and quizzes that mark themselves. Chapter 1 of every subject is free.',
}

/**
 * Public landing page.
 *
 * Every figure on this page is read from the database at request time — chapter
 * and lesson counts, which subjects exist, which chapters are free, and the real
 * bundle price. Nothing here is a marketing number typed by hand, so the page
 * cannot drift away from what the catalog actually contains.
 */
export default async function LandingPage() {
  // Someone already signed in doesn't need the pitch.
  if (await currentUser()) redirect('/academic')

  const [boards, freeTopics, totals] = await Promise.all([
    // Only boards that actually have classes. Offering an empty one leaves the
    // class dropdown blank and signup rejects the form with no way forward.
    prisma.board.findMany({
      where: { classes: { some: {} } },
      orderBy: { code: 'asc' },
      include: { classes: { orderBy: { sortKey: 'asc' }, select: { id: true, label: true } } },
    }),
    prisma.topic.count({ where: { videoUrl: { not: null } } }),
    // Same filter as the count above. Summing every topic counted lessons that
    // are still in production towards "hours of teaching" — a number the
    // visitor cannot watch.
    prisma.topic.aggregate({ _sum: { durationSec: true }, where: { videoUrl: { not: null } } }),
  ])

  // The class the catalog itself would show a signed-out visitor, so the
  // headline numbers match what they see one click later.
  const featured = await prisma.classLevel.findFirst({
    where: { courses: { some: { chapters: { some: { topics: { some: { videoUrl: { not: null } } } } } } } },
    orderBy: { sortKey: 'asc' },
    include: {
      board: true,
      courses: {
        orderBy: { sortKey: 'asc' },
        include: {
          subject: true,
          chapters: {
            orderBy: { index: 'asc' },
            include: { _count: { select: { topics: true, questions: true } } },
          },
        },
      },
    },
  })

  const courses = featured?.courses ?? []
  const chapterCount = courses.reduce((n, c) => n + c.chapters.length, 0)
  const quizzedChapters = courses.reduce(
    (n, c) => n + c.chapters.filter((ch) => ch._count.questions > 0).length,
    0,
  )
  const freeChapters = courses.flatMap((c) =>
    c.chapters.filter((ch) => ch.isFree).map((ch) => ({ ...ch, subject: c.subject.name })),
  )

  const bundle = featured?.bundlePricePaise ?? null
  const listPrice = featured?.bundleListPricePaise ?? null
  const saving = bundle && listPrice ? listPrice - bundle : null

  return (
    <div className="min-h-dvh">
      {/* ------------------------------------------------------------- header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <span className="text-2xl font-extrabold tracking-tight text-navy-deep">
          paper<span className="text-ember">Path</span>
        </span>
        <nav className="flex items-center gap-2">
          <Link
            href="/academic"
            className="rounded-full px-4 py-2 text-sm font-bold text-navy-deep/75 transition hover:text-navy-deep"
          >
            Browse courses
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-navy-deep shadow-sm transition hover:shadow"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* --------------------------------------------------------------- hero */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-14">
        <div className="hero-surface relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-white/45 blur-3xl" />

          <div className="relative grid items-start gap-10 lg:grid-cols-[1.15fr_minmax(0,26rem)]">
            <div>
              <p className="text-sm font-bold text-navy/70">
                {boards.map((b) => b.code).join(' · ')} · Class 5–12
              </p>

              <h1 className="mt-3 text-4xl font-extrabold leading-[1.08] tracking-tight text-navy-deep sm:text-5xl">
                Chapter-wise lessons,
                <br />
                <span className="text-ember">and a tutor that knows the chapter.</span>
              </h1>

              <p className="mt-4 max-w-xl text-lg font-semibold text-navy/60">
                Watch the lecture, ask the AI tutor when you get stuck, then take the chapter quiz.
                Chapter 1 of every subject is free — no card, no trial timer.
              </p>

              {/* Stats, all counted from the catalog itself. */}
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
                <Stat icon={<IconBook className="size-4 text-navy" />} value={String(chapterCount)} label="CHAPTERS" />
                <Stat icon={<IconPlay className="size-4 text-moss" />} value={String(freeTopics)} label="VIDEO LESSONS" />
                <Stat
                  icon={<IconClock className="size-4 text-amber" />}
                  value={formatDuration(totals._sum.durationSec ?? 0)}
                  label="OF TEACHING"
                />
                {quizzedChapters > 0 && (
                  <Stat
                    icon={<IconList className="size-4 text-navy" />}
                    value={String(quizzedChapters)}
                    label="MARKED QUIZZES"
                  />
                )}
              </dl>

              {freeChapters.length > 0 && (
                <div className="mt-8">
                  <p className="text-xs font-extrabold tracking-wider text-navy/45">
                    START HERE — FREE, RIGHT NOW
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {freeChapters.map((ch) => (
                      <li key={ch.id}>
                        <Link
                          href={`/academic?class=${featured?.slug}`}
                          className="inline-flex items-center gap-2 rounded-full border border-navy/12 bg-white/80 px-4 py-2 text-sm font-bold text-navy-deep transition hover:border-amber"
                        >
                          <IconPlay className="size-3.5 text-moss" />
                          {ch.subject} · {ch.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Sign in / create an account, without leaving the page. */}
            <LandingAuth
              boards={boards.map((b) => ({ id: b.id, code: b.code, name: b.name, classes: b.classes }))}
            />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- features */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={<IconPlay className="size-5" />}
            title="Video lectures"
            body="Every chapter split into short topics. It remembers where you stopped and marks the topic done when you finish."
          />
          <Feature
            icon={<IconRobot className="size-5" />}
            title="AI tutor, chapter-aware"
            body="It already knows which chapter and which topics you're on, so you don't have to explain the question twice."
          />
          <Feature
            icon={<IconList className="size-5" />}
            title="Quizzes that mark themselves"
            body="Answers are checked on the server, never sent to your browser. Explanations appear once you submit."
          />
          <Feature
            icon={<IconSparkles className="size-5" />}
            title="Study tools"
            body="Generate a one-page formula sheet, fresh practice questions, or a worked answer to the doubt you're stuck on."
          />
        </div>
      </section>

      {/* ------------------------------------------------------------ syllabus */}
      {courses.length > 0 && featured && (
        <section className="mx-auto w-full max-w-6xl px-5 pb-14">
          <h2 className="text-2xl font-extrabold text-navy-deep">
            What&apos;s inside {featured.label.replace('Class - ', 'Class ')}
          </h2>
          <p className="mt-1 font-semibold text-navy/50">
            Straight from the catalog — this is the real chapter list, not a sample.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <article key={c.id} className="rounded-3xl card-surface px-6 py-5">
                <h3 className="font-extrabold text-navy-deep">{c.subject.name}</h3>
                <p className="mt-0.5 text-sm font-bold text-navy/45">
                  {c.chapters.length} chapters ·{' '}
                  {c.chapters.reduce((n, ch) => n + ch._count.topics, 0)} lessons
                </p>
                <ul className="mt-3 space-y-1.5">
                  {c.chapters.slice(0, 4).map((ch) => (
                    <li key={ch.id} className="flex items-start gap-2 text-sm font-semibold text-navy/65">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-navy/25" />
                      <span>
                        {ch.title}
                        {ch.isFree && (
                          <span className="ml-1.5 rounded bg-moss/15 px-1.5 py-0.5 text-[11px] font-extrabold text-moss">
                            FREE
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {c.chapters.length > 4 && (
                  <p className="mt-2 text-sm font-bold text-navy/40">
                    + {c.chapters.length - 4} more chapters
                  </p>
                )}
                <Link
                  href={`/academic?class=${featured.slug}&subject=${c.subject.slug}`}
                  className="mt-4 inline-block text-sm font-extrabold text-ember hover:underline"
                >
                  See all chapters →
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- pricing */}
      {featured && bundle && (
        <section className="mx-auto w-full max-w-6xl px-5 pb-14">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl card-surface px-8 py-7">
              <p className="text-sm font-extrabold tracking-wider text-navy/45">FREE FOREVER</p>
              <p className="mt-2 text-3xl font-extrabold text-navy-deep">₹0</p>
              <ul className="mt-4 space-y-2">
                <Perk>Chapter 1 of every subject, in full</Perk>
                <Perk>AI tutor with a daily message allowance</Perk>
                <Perk>Progress tracking and notes</Perk>
              </ul>
              <a
                href="#join"
                className="mt-6 inline-block rounded-2xl border border-navy/15 bg-white px-6 py-3 font-extrabold text-navy-deep transition hover:border-amber"
              >
                Create a free account
              </a>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-[#2b1a06] to-[#3d2408] px-8 py-7 text-white">
              <p className="text-sm font-extrabold tracking-wider text-amber">
                COMPLETE {featured.label.replace('Class - ', 'CLASS ').toUpperCase()}
              </p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold">{formatPaise(bundle)}</span>
                {listPrice && (
                  <span className="text-sm font-bold line-through opacity-45">
                    {formatPaise(listPrice)}
                  </span>
                )}
                <span className="text-sm font-bold opacity-50">/yr</span>
              </p>
              <ul className="mt-4 space-y-2">
                <Perk dark>All {courses.length} subjects, every chapter</Perk>
                <Perk dark>
                  {saving ? `Save ${formatPaise(saving)} vs buying separately` : 'Full-year access'}
                </Perk>
                <Perk dark>A much larger daily AI tutor allowance</Perk>
              </ul>
              <Link
                href={`/checkout?class=${featured.slug}`}
                className="mt-6 inline-block rounded-2xl flame-gradient px-6 py-3 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105"
              >
                See the plan
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------- footer */}
      <footer className="mx-auto w-full max-w-6xl px-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy/10 pt-6 text-sm font-semibold text-navy/45">
          <span>
            paper<span className="text-ember">Path</span> — built for Indian school students.
          </span>
          <span className="flex gap-4">
            <Link href="/terms" className="hover:text-ember">
              Terms of Use
            </Link>
            <Link href="/privacy" className="hover:text-ember">
              Privacy Policy
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div>
      <dd className="flex items-center gap-1.5 text-2xl font-extrabold text-navy-deep">
        {icon}
        {value}
      </dd>
      <dt className="text-xs font-bold tracking-wider text-navy/45">{label}</dt>
    </div>
  )
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-3xl card-surface px-6 py-5">
      <span className="grid size-10 place-items-center rounded-2xl flame-gradient text-white">
        {icon}
      </span>
      <h3 className="mt-3 font-extrabold text-navy-deep">{title}</h3>
      <p className="mt-1 text-sm font-semibold text-navy/55">{body}</p>
    </div>
  )
}

function Perk({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <li
      className={
        dark
          ? 'flex gap-2 text-sm font-semibold text-white/80'
          : 'flex gap-2 text-sm font-semibold text-navy/65'
      }
    >
      <IconCheck className="mt-0.5 size-4 shrink-0 text-moss" />
      {children}
    </li>
  )
}
