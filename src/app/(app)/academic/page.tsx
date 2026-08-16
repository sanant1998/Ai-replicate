import Link from 'next/link'
import { notFound } from 'next/navigation'
import clsx from 'clsx'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'
import { canAccessChapter, getEntitlements } from '@/lib/access'
import { formatDuration, formatPaise } from '@/lib/format'
import { ClassPicker } from '@/components/ClassPicker'
import { IconBook, IconChevron, IconClock, IconList, IconLock, IconPlay, IconRobot, IconSparkles } from '@/components/icons'

export const metadata = {
  title: 'Course catalog — chapter-wise lessons for Class 5 to 12 | PaperPath',
  description:
    'Browse CBSE, ICSE and state board courses by class and subject. Chapter 1 of every subject is free to watch.',
}

/**
 * Which class a signed-out visitor should see. "Most published lessons" rather
 * than "lowest class with any lesson", so adding a single chapter to Class 5
 * doesn't move the front page off the class that actually has a course on it.
 */
async function mostPublishedClassSlug(): Promise<string | undefined> {
  const rows = await prisma.$queryRaw<{ slug: string }[]>`
    SELECT cl.slug
    FROM "ClassLevel" cl
    JOIN "Course"  c  ON c."classLevelId" = cl.id
    JOIN "Chapter" ch ON ch."courseId"    = c.id
    JOIN "Topic"   t  ON t."chapterId"    = ch.id
    WHERE t."videoUrl" IS NOT NULL
    GROUP BY cl.id, cl.slug, cl."sortKey"
    ORDER BY COUNT(t.id) DESC, cl."sortKey" ASC
    LIMIT 1
  `
  return rows[0]?.slug
}

export default async function AcademicPage(props: PageProps<'/academic'>) {
  const sp = await props.searchParams
  const subjectSlug = typeof sp.subject === 'string' ? sp.subject : 'all'
  const query = (typeof sp.q === 'string' ? sp.q : '').trim()

  const session = await readSession()
  const ent = await getEntitlements(session?.uid ?? null)

  const classLevels = await prisma.classLevel.findMany({
    orderBy: { sortKey: 'asc' },
    include: { board: true },
  })

  // No ?class= means "show me my own class". Signed-out visitors get the first
  // class that actually has lessons — never a hard-coded slug (which sent Class
  // 10 students to the Class 8 catalog) and never simply the lowest class, which
  // would be an empty page for a first-time visitor.
  const ownClassSlug = session
    ? (
        await prisma.user.findUnique({
          where: { id: session.uid },
          select: { classLevel: { select: { slug: true } } },
        })
      )?.classLevel?.slug
    : undefined

  const fallbackSlug = ownClassSlug ?? (await mostPublishedClassSlug()) ?? classLevels[0]?.slug

  const classSlug = (typeof sp.class === 'string' ? sp.class : undefined) ?? fallbackSlug

  const classLevel = classLevels.find((c) => c.slug === classSlug)
  if (!classLevel) notFound()

  const courses = await prisma.course.findMany({
    where: { classLevelId: classLevel.id },
    orderBy: { sortKey: 'asc' },
    include: {
      subject: true,
      chapters: {
        orderBy: { index: 'asc' },
        include: { topics: { orderBy: { index: 'asc' } } },
      },
    },
  })

  const bySubject =
    subjectSlug === 'all' ? courses : courses.filter((c) => c.subject.slug === subjectSlug)

  // Search matches a chapter's own title or any of its topic titles, and drops
  // courses left with nothing so the page doesn't render empty subject headings.
  const visible = query
    ? bySubject
        .map((c) => ({
          ...c,
          chapters: c.chapters.filter(
            (ch) =>
              ch.title.toLowerCase().includes(query.toLowerCase()) ||
              ch.topics.some((t) => t.title.toLowerCase().includes(query.toLowerCase())),
          ),
        }))
        .filter((c) => c.chapters.length > 0)
    : bySubject

  const stats = visible.reduce(
    (acc, c) => {
      acc.chapters += c.chapters.length
      for (const ch of c.chapters) {
        acc.topics += ch.topics.length
        for (const t of ch.topics) {
          acc.durationSec += t.durationSec
          if (t.videoUrl) acc.videos += 1
        }
      }
      return acc
    },
    { chapters: 0, topics: 0, videos: 0, durationSec: 0 },
  )

  const bundleSaving =
    classLevel.bundleListPricePaise && classLevel.bundlePricePaise
      ? classLevel.bundleListPricePaise - classLevel.bundlePricePaise
      : null

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------------- hero */}
      <section className="hero-surface relative overflow-hidden rounded-3xl px-6 py-7 sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/40 blur-2xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-navy/70">
              {classLevel.board.code} · State Boards ·{' '}
              <span className="text-ember">Chapter-wise video lectures</span>
            </p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-navy sm:text-5xl">
              {classLevel.label}
            </h1>
            <p className="text-lg font-bold text-navy/60">
              {subjectSlug === 'all' ? 'All Subjects' : visible[0]?.subject.name ?? 'All Subjects'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/tutor?mode=career"
              className="flex items-center gap-2 rounded-full flame-gradient px-4 py-2.5 text-sm font-extrabold text-white shadow-md shadow-ember/25 transition hover:brightness-105"
            >
              <IconBook className="size-4" /> Career <span className="font-medium opacity-90">GUIDE</span>
            </Link>
            <Link
              href="/tutor"
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-extrabold text-navy shadow-md"
            >
              <span className="size-2 rounded-full bg-ember" /> Live{' '}
              <span className="font-medium opacity-70">AI TUTOR</span>
            </Link>
          </div>
        </div>

        {/* filters */}
        <div className="relative mt-6 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold tracking-wider text-navy/45">CLASS</span>
          <ClassPicker
            classLevels={classLevels.map((c) => ({ slug: c.slug, label: c.label }))}
            current={classSlug}
            subject={subjectSlug}
          />

          <span className="ml-2 text-xs font-bold tracking-wider text-navy/45">SUBJECT</span>
          {courses.map((c) => (
            <FilterChip
              key={c.id}
              href={`/academic?class=${classSlug}&subject=${c.subject.slug}`}
              active={subjectSlug === c.subject.slug}
              label={c.subject.name}
            />
          ))}
          <FilterChip href={`/academic?class=${classSlug}&subject=all`} active={subjectSlug === 'all'} label="All" />

          <form method="get" action="/academic" className="ml-auto flex items-center gap-2">
            <input type="hidden" name="class" value={classSlug} />
            <input type="hidden" name="subject" value={subjectSlug} />
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search chapters…"
              aria-label="Search chapters and topics"
              className="w-48 rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm font-semibold text-navy-deep outline-none transition focus:border-amber"
            />
            {query && (
              <Link
                href={`/academic?class=${classSlug}&subject=${subjectSlug}`}
                className="text-sm font-bold text-navy/45 hover:text-ember"
              >
                Clear
              </Link>
            )}
          </form>
        </div>

        {query && (
          <p className="relative mt-3 text-sm font-bold text-navy/55">
            {stats.chapters === 0
              ? `Nothing matches “${query}” in this class.`
              : `${stats.chapters} chapter${stats.chapters === 1 ? '' : 's'} matching “${query}”.`}
          </p>
        )}

        {/* stats */}
        <div className="relative mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-navy/10 pt-4">
          <Stat icon={<IconBook className="size-4 text-navy" />} value={stats.chapters} label="CHAPTERS" tone="text-navy" />
          <Stat icon={<IconList className="size-4 text-navy" />} value={stats.topics} label="TOPICS" tone="text-navy" />
          <Stat icon={<IconPlay className="size-4 text-moss" />} value={stats.videos} label="VIDEOS" tone="text-moss" />
          <Stat
            icon={<IconClock className="size-4 text-amber" />}
            value={formatDuration(stats.durationSec)}
            label="VIDEO CONTENT"
            tone="text-amber"
          />
        </div>
      </section>

      {/* --------------------------------------------------------- bundle offer */}
      {classLevel.bundlePricePaise && subjectSlug === 'all' && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-[#2b1a06] to-[#3d2408] px-7 py-6">
          <div>
            <h2 className="text-2xl font-extrabold text-amber">
              ★ Complete {classLevel.label.replace('Class - ', 'Class ').replace('th', '')} — All Subjects
            </h2>
            <p className="mt-1 text-sm font-semibold text-white/60">
              {courses.length} subjects · full-year access
              {bundleSaving ? (
                <>
                  {' '}
                  · <span className="text-moss">Save {formatPaise(bundleSaving)} vs buying separately</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <p className="text-3xl font-extrabold text-white">
              {formatPaise(classLevel.bundlePricePaise)}
              <span className="text-base font-bold text-white/50">/yr</span>
            </p>
            <Link
              href={`/checkout?class=${classSlug}`}
              className="rounded-full flame-gradient px-7 py-3 font-extrabold text-white shadow-lg shadow-ember/30 transition hover:brightness-105"
            >
              Buy Now
            </Link>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ chapters */}
      {visible.map((course) => (
        <section key={course.id} className="space-y-2.5">
          <h2 className="flex items-center gap-2 border-b border-navy/10 pb-2 text-lg font-extrabold text-navy">
            <span
              className="inline-block size-4 rounded-md"
              style={{ background: `linear-gradient(135deg, ${course.subject.colorFrom}, ${course.subject.colorTo})` }}
            />
            {course.subject.name}
          </h2>

          {course.chapters.length === 0 && (
            <p className="rounded-3xl card-surface px-6 py-8 text-center text-sm font-semibold text-navy/50">
              Lessons for this subject are being produced. Check back soon.
            </p>
          )}

          {course.chapters.map((chapter) => {
            const unlocked = canAccessChapter(chapter, course, ent)
            const seconds = chapter.topics.reduce((s, t) => s + t.durationSec, 0)
            const firstTopic = chapter.topics[0]

            return (
              <article
                key={chapter.id}
                className="flex items-center gap-4 rounded-3xl card-surface px-4 py-3.5 transition hover:-translate-y-px"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-navy text-sm font-extrabold text-white">
                  {chapter.index}
                </span>

                <Link
                  href={unlocked && firstTopic ? `/learn/${firstTopic.id}` : `/checkout?course=${course.id}`}
                  className="min-w-0 flex-1"
                >
                  <h3 className="truncate font-bold text-navy-deep">{chapter.title}</h3>
                  <p className="text-[13px] font-semibold text-navy/45">
                    {chapter.topics.length} topics · {formatDuration(seconds)}
                    {chapter.isFree && <span className="ml-2 font-extrabold text-moss">FREE</span>}
                  </p>
                </Link>

                <IconChevron className="size-4 shrink-0 text-navy/30" />

                {unlocked ? (
                  <Link
                    href={`/tutor?chapter=${chapter.id}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-sm font-bold text-white transition hover:bg-navy-deep"
                  >
                    <IconRobot className="size-4" /> AI Tutor
                  </Link>
                ) : (
                  <Link
                    href={`/checkout?course=${course.id}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-navy/15 px-4 py-2 text-sm font-bold text-navy/60 transition hover:bg-navy/25"
                  >
                    <IconLock className="size-4" /> Locked
                  </Link>
                )}
              </article>
            )
          })}
        </section>
      ))}

      {/* ------------------------------------------------------------- upsell */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl card-surface px-7 py-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-navy">
            <IconSparkles className="size-5 text-amber" /> Unlock All Video Lectures
          </h2>
          <p className="text-sm font-semibold text-navy/50">
            Subscribe to Premium to watch every lecture. Chapter 1 of each subject is always free.
          </p>
        </div>
        <Link
          href={`/pricing?class=${classLevel.slug}`}
          className="rounded-full flame-gradient px-6 py-3 font-extrabold text-white shadow-lg shadow-ember/25"
        >
          See plans
        </Link>
      </section>
    </div>
  )
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={clsx(
        'rounded-xl border px-4 py-2 text-sm font-bold transition',
        active
          ? 'border-amber bg-white text-ember shadow-sm'
          : 'border-navy/10 bg-white/60 text-navy/70 hover:border-navy/25',
      )}
    >
      {label}
    </Link>
  )
}

function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode
  value: string | number
  label: string
  tone: string
}) {
  return (
    <span className="flex items-center gap-2">
      {icon}
      <span className={clsx('text-xl font-extrabold', tone)}>{value}</span>
      <span className="text-xs font-bold tracking-wider text-navy/45">{label}</span>
    </span>
  )
}
