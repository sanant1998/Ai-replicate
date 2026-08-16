import Link from 'next/link'
import { notFound } from 'next/navigation'
import clsx from 'clsx'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'
import { canAccessChapter, getEntitlements } from '@/lib/access'
import { formatClock, formatDuration } from '@/lib/format'
import { VideoPlayer } from '@/components/VideoPlayer'
import { issuePlaybackTicket } from '@/lib/video'
import { NotesPanel } from '@/components/NotesPanel'
import { toggleBookmark } from '@/app/(app)/study-actions'
import { IconCheck, IconList, IconLock, IconPlay, IconRobot } from '@/components/icons'

/**
 * Free chapters are the pages a parent finds by searching for a chapter name,
 * so the title has to carry the subject and class rather than say "PaperPath".
 * No entitlement check here: the metadata describes what the lesson *is*, which
 * is the same sales pitch whether the visitor can play it or not.
 */
export async function generateMetadata(props: PageProps<'/learn/[topicId]'>) {
  const { topicId } = await props.params
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: {
      title: true,
      chapter: {
        select: {
          title: true,
          index: true,
          course: {
            select: { subject: { select: { name: true } }, classLevel: { select: { label: true } } },
          },
        },
      },
    },
  })
  if (!topic) return { title: 'Lesson not found — PaperPath' }

  const { chapter } = topic
  const course = chapter.course
  const title = `${topic.title} — ${course.subject.name}, ${course.classLevel.label} | PaperPath`
  const description = `Video lesson on ${topic.title}, from Chapter ${chapter.index}: ${chapter.title} of ${course.subject.name} for ${course.classLevel.label}.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'video.other' as const },
  }
}

export default async function LearnPage(props: PageProps<'/learn/[topicId]'>) {
  const { topicId } = await props.params
  const session = await readSession()

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      chapter: {
        include: {
          course: { include: { subject: true, classLevel: true } },
          topics: { orderBy: { index: 'asc' } },
        },
      },
    },
  })
  if (!topic) notFound()

  const { chapter } = topic
  const ent = await getEntitlements(session?.uid ?? null)
  const unlocked = canAccessChapter(chapter, chapter.course, ent)

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl card-surface px-8 py-12 text-center">
        <IconLock className="mx-auto size-10 text-navy/30" />
        <h1 className="mt-4 text-2xl font-extrabold text-navy-deep">This chapter is locked</h1>
        <p className="mt-2 font-semibold text-navy/55">
          {chapter.course.subject.name} · Chapter {chapter.index}: {chapter.title}
        </p>
        <p className="mt-4 text-sm font-semibold text-navy/45">
          Chapter 1 of every subject is free. Unlock the rest with a {chapter.course.classLevel.label} plan.
        </p>
        <Link
          href={`/checkout?course=${chapter.courseId}`}
          className="mt-6 inline-block rounded-full flame-gradient px-7 py-3 font-extrabold text-white shadow-lg shadow-ember/25"
        >
          See plans
        </Link>
      </div>
    )
  }

  const progress = session
    ? await prisma.progress.findMany({
        where: { userId: session.uid, topicId: { in: chapter.topics.map((t) => t.id) } },
      })
    : []
  const byTopic = new Map(progress.map((p) => [p.topicId, p]))
  const here = byTopic.get(topic.id)

  const doneCount = chapter.topics.filter((t) => byTopic.get(t.id)?.completed).length
  const pct = Math.round((doneCount / chapter.topics.length) * 100)

  // Only offer the quiz link on chapters that actually have questions written.
  const questionCount = await prisma.question.count({ where: { chapterId: chapter.id } })

  const notes = session
    ? await prisma.note.findMany({
        where: { userId: session.uid, topicId: topic.id },
        orderBy: { atSec: 'asc' },
      })
    : []

  const bookmarked = session
    ? Boolean(
        await prisma.bookmark.findUnique({
          where: { userId_chapterId: { userId: session.uid, chapterId: chapter.id } },
        }),
      )
    : false

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <nav className="text-sm font-semibold text-navy/50">
          <Link href={`/academic?class=${chapter.course.classLevel.slug}`} className="hover:text-ember">
            {chapter.course.classLevel.label}
          </Link>
          <span className="mx-1.5">/</span>
          <Link
            href={`/academic?class=${chapter.course.classLevel.slug}&subject=${chapter.course.subject.slug}`}
            className="hover:text-ember"
          >
            {chapter.course.subject.name}
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-navy-deep">Chapter {chapter.index}</span>
        </nav>

        {topic.videoUrl ? (
          <VideoPlayer
            topicId={topic.id}
            // A signed, expiring, account-bound ticket — never the CDN URL itself.
            src={`/api/video/${topic.id}?t=${issuePlaybackTicket(topic.id, session?.uid ?? null)}`}
            hls={topic.videoUrl.includes('.m3u8')}
            poster={topic.posterUrl}
            startAt={here?.positionSec ?? 0}
          />
        ) : (
          <div className="grid aspect-video place-items-center rounded-2xl bg-navy/5 text-sm font-bold text-navy/40">
            This lesson is still in production.
          </div>
        )}

        <div className="rounded-3xl card-surface px-6 py-5">
          <h1 className="text-2xl font-extrabold text-navy-deep">{topic.title}</h1>
          <p className="mt-1 font-semibold text-navy/50">
            {chapter.title} · {formatDuration(topic.durationSec)}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/tutor?chapter=${chapter.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white transition hover:bg-navy-deep"
            >
              <IconRobot className="size-4" />
              Ask the AI tutor about this chapter
            </Link>
            {questionCount > 0 && (
              <Link
                href={`/quiz/${chapter.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white px-5 py-2.5 text-sm font-bold text-navy-deep transition hover:border-amber"
              >
                <IconList className="size-4" />
                Take the chapter quiz
              </Link>
            )}
            {session && (
              <form action={toggleBookmark}>
                <input type="hidden" name="chapterId" value={chapter.id} />
                <input type="hidden" name="from" value={`/learn/${topic.id}`} />
                <button
                  type="submit"
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold transition',
                    bookmarked
                      ? 'border-amber bg-amber/15 text-navy-deep'
                      : 'border-navy/15 bg-white text-navy-deep hover:border-amber',
                  )}
                >
                  {bookmarked ? '★ Saved' : '☆ Save chapter'}
                </button>
              </form>
            )}
          </div>
        </div>

        {session && (
          <NotesPanel
            topicId={topic.id}
            notes={notes.map((n) => ({
              id: n.id,
              body: n.body,
              atSec: n.atSec,
              createdAt: n.createdAt.toISOString(),
            }))}
          />
        )}
      </div>

      {/* ------------------------------------------------------------ playlist */}
      <aside className="rounded-3xl card-surface p-4 lg:sticky lg:top-6 lg:self-start">
        <div className="px-2 pb-3">
          <p className="text-sm font-extrabold text-navy-deep">
            Chapter {chapter.index} · {chapter.title}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy/10">
            <div className="h-full rounded-full flame-gradient transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs font-bold text-navy/45">
            {doneCount} of {chapter.topics.length} topics complete
          </p>
        </div>

        <ol className="scroll-slim max-h-[60vh] space-y-1 overflow-y-auto">
          {chapter.topics.map((t) => {
            const p = byTopic.get(t.id)
            const active = t.id === topic.id
            return (
              <li key={t.id}>
                <Link
                  href={`/learn/${t.id}`}
                  className={clsx(
                    'flex items-start gap-3 rounded-xl px-3 py-2.5 transition',
                    active ? 'bg-navy/10' : 'hover:bg-navy/5',
                  )}
                >
                  <span
                    className={clsx(
                      'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
                      p?.completed ? 'bg-moss text-white' : 'bg-navy/15 text-navy/60',
                    )}
                  >
                    {p?.completed ? <IconCheck className="size-3" /> : <IconPlay className="size-2.5" />}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={clsx(
                        'block truncate text-sm',
                        active ? 'font-extrabold text-navy-deep' : 'font-semibold text-navy-deep/80',
                      )}
                    >
                      {/* The chapter name is already in the header above — don't repeat it. */}
                      {t.title.startsWith(`${chapter.title} — `)
                        ? t.title.slice(chapter.title.length + 3)
                        : t.title}
                    </span>
                    <span className="text-xs font-semibold text-navy/40">
                      {formatDuration(t.durationSec)}
                      {p && !p.completed && p.positionSec > 0 && (
                        <span className="ml-1.5 text-amber">· resume {formatClock(p.positionSec)}</span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </aside>
    </div>
  )
}
