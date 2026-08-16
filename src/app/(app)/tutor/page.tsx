import { redirect } from 'next/navigation'
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
    // Send them straight to sign-in rather than showing a dead-end card, and
    // carry the destination so Career Guide reopens in career mode afterwards
    // instead of dropping them on the general tutor.
    const target = career
      ? '/tutor?mode=career'
      : chapterId
        ? `/tutor?chapter=${encodeURIComponent(chapterId)}`
        : '/tutor'
    redirect(`/login?next=${encodeURIComponent(target)}`)
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

  // Resume the most recent session for this scope so a refresh doesn't lose
  // context. Matched on mode as well as chapter, exactly as /api/tutor does:
  // both modes use a null chapterId, so without it the career guide would open
  // showing the last homework conversation — and the session id handed to the
  // client would be one the API then rejects, silently forking a fresh session
  // whose history the model never sees.
  const mode = career ? 'CAREER' : 'TUTOR'
  const existing = await prisma.chatSession.findFirst({
    where: { userId: user.id, chapterId: chapter?.id ?? null, mode },
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
