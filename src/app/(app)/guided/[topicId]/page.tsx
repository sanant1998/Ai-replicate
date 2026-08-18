import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/session'
import { ensureDailyCredits } from '@/lib/credits'
import { canAccessChapter, getEntitlements } from '@/lib/access'
import { suggestionsFromContent } from '@/lib/guided'
import { GuidedChat, type GuidedTurn } from '@/components/GuidedChat'

export const dynamic = 'force-dynamic'

export default async function GuidedTopicPage(props: PageProps<'/guided/[topicId]'>) {
  const { topicId } = await props.params

  const user = await currentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/guided/${topicId}`)}`)

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      chapter: { include: { course: { include: { subject: true } } } },
      answers: { orderBy: { index: 'asc' }, take: 3 },
    },
  })
  if (!topic?.content?.trim()) notFound()

  if (!user.testMode) {
    const ent = await getEntitlements(user.id)
    if (!canAccessChapter(topic.chapter, topic.chapter.course, ent)) notFound()
  }

  // Resume the last conversation about this topic. Scoped by topic as well as
  // mode: two guided sessions under the same account are two different sets of
  // material, and replaying one under the other's prompt would show the model a
  // history it could not have written.
  const existing = await prisma.chatSession.findFirst({
    where: { userId: user.id, mode: 'GUIDED', topicId: topic.id },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 40 } },
  })

  const initialMessages: GuidedTurn[] =
    existing?.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      steps: m.steps,
    })) ?? []

  // Best: the client's own answer-key questions — those have an exact answer
  // waiting behind them. Next best: the questions in the material itself, read
  // straight out of the text. Last: three sentences made from the title, which
  // is what a topic with neither gets, and which is worth as little as it looks
  // — the title is often not what the material is about.
  const fromContent = topic.answers.length > 0 ? [] : suggestionsFromContent(topic.content)
  const suggestions =
    topic.answers.length > 0
      ? topic.answers.map((a) => a.question)
      : fromContent.length > 0
        ? fromContent
        : [
            `Explain ${topic.title} in simple words.`,
            `Give me a worked example from ${topic.title}.`,
            `What is the most important point in ${topic.title}?`,
          ]

  const fresh = user.testMode ? null : await ensureDailyCredits(user.id)

  return (
    <div className="space-y-3">
      <Link href="/guided" className="text-sm font-bold text-navy/45 hover:text-ember">
        ← All topics
      </Link>
      <GuidedChat
        topicId={topic.id}
        topicLabel={`${topic.chapter.course.subject.name} · Ch ${topic.chapter.index}: ${topic.chapter.title} · ${topic.title}`}
        initialSessionId={existing?.id}
        initialMessages={initialMessages}
        suggestions={suggestions}
        credits={fresh?.dailyCredits ?? null}
      />
    </div>
  )
}
