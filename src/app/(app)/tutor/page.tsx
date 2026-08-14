import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'
import { ensureDailyCredits } from '@/lib/credits'
import { canAccessChapter, getEntitlements } from '@/lib/access'
import { TutorChat, type ChatTurn } from '@/components/TutorChat'

const GENERAL_SUGGESTIONS = [
  'Explain rational numbers with an example I can picture.',
  'I keep mixing up mass and weight — help me separate them.',
  'Give me three practice questions on linear equations.',
]

const CAREER_SUGGESTIONS = [
  'Which subjects should I focus on if I want to be an engineer?',
  'What streams can I pick after Class 10, and what does each lead to?',
  'I like biology and drawing — what careers combine them?',
]

export default async function TutorPage(props: PageProps<'/tutor'>) {
  const sp = await props.searchParams
  const chapterId = typeof sp.chapter === 'string' ? sp.chapter : undefined
  const career = sp.mode === 'career'

  const session = await readSession()
  if (!session) {
    return (
      <div className="mx-auto max-w-md rounded-3xl card-surface px-8 py-12 text-center">
        <h1 className="text-2xl font-extrabold text-navy-deep">Sign in to use the AI tutor</h1>
        <p className="mt-2 font-semibold text-navy/55">
          Every account gets free daily credits.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-full flame-gradient px-7 py-3 font-extrabold text-white shadow-lg shadow-ember/25"
        >
          Sign in
        </Link>
      </div>
    )
  }

  const user = await ensureDailyCredits(session.uid)

  let chapter = null
  if (chapterId) {
    chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { course: { include: { subject: true } }, topics: { orderBy: { index: 'asc' } } },
    })
    if (chapter) {
      const ent = await getEntitlements(user.id)
      if (!canAccessChapter(chapter, chapter.course, ent)) chapter = null
    }
  }

  // Resume the most recent session for this scope so a refresh doesn't lose context.
  const existing = await prisma.chatSession.findFirst({
    where: { userId: user.id, chapterId: chapter?.id ?? null },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 40 } },
  })

  const initialMessages: ChatTurn[] =
    existing?.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })) ?? []

  const suggestions = career
    ? CAREER_SUGGESTIONS
    : chapter
      ? [
          `Give me a two-minute overview of ${chapter.title}.`,
          `What is the hardest idea in ${chapter.title}, and how do I get past it?`,
          `Quiz me on ${chapter.title} — one question at a time.`,
        ]
      : GENERAL_SUGGESTIONS

  return (
    <TutorChat
      chapterId={chapter?.id}
      mode={career ? 'career' : undefined}
      chapterLabel={
        career
          ? 'Career guidance — streams, subjects and where they lead'
          : chapter
            ? `${chapter.course.subject.name} · Ch ${chapter.index}: ${chapter.title}`
            : undefined
      }
      initialSessionId={existing?.id}
      initialMessages={initialMessages}
      credits={user.dailyCredits}
      suggestions={suggestions}
    />
  )
}
