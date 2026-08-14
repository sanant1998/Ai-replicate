'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { currentUser, isUnauthenticated, requireUser, SIGNED_OUT_MESSAGE } from '@/lib/session'
import { canAccessChapter, getEntitlements } from '@/lib/access'
import { grade } from '@/lib/quiz'
import { hit } from '@/lib/rate-limit'

export type QuizState = { error?: string; attemptId?: string }

async function assertChapterAccess(userId: string, chapterId: string) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { course: true },
  })
  if (!chapter) return null
  const ent = await getEntitlements(userId)
  return canAccessChapter(chapter, chapter.course, ent) ? chapter : null
}

export async function startAttempt(_prev: QuizState, formData: FormData): Promise<QuizState> {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    if (isUnauthenticated(err)) return { error: SIGNED_OUT_MESSAGE }
    throw err
  }
  const chapterId = String(formData.get('chapterId') ?? '')

  const burst = hit(`quiz:start:${user.id}`, 20, 60_000)
  if (!burst.ok) return { error: 'Slow down a moment and try again.' }

  const chapter = await assertChapterAccess(user.id, chapterId)
  if (!chapter) return { error: 'You do not have access to this chapter.' }

  const count = await prisma.question.count({ where: { chapterId } })
  if (count === 0) return { error: 'No questions have been written for this chapter yet.' }

  // Reuse an unfinished attempt rather than stacking up abandoned ones.
  const open = await prisma.quizAttempt.findFirst({
    where: { userId: user.id, chapterId, submittedAt: null },
    orderBy: { startedAt: 'desc' },
  })
  if (open) return { attemptId: open.id }

  const attempt = await prisma.quizAttempt.create({
    data: { userId: user.id, chapterId },
  })
  return { attemptId: attempt.id }
}

export async function submitAttempt(_prev: QuizState, formData: FormData): Promise<QuizState> {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    // Losing a session mid-quiz must not lose the answers to a 500 page.
    if (isUnauthenticated(err)) return { error: SIGNED_OUT_MESSAGE }
    throw err
  }
  const attemptId = String(formData.get('attemptId') ?? '')

  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, userId: user.id },
    include: { chapter: { include: { course: true } } },
  })
  if (!attempt) return { error: 'That attempt no longer exists.' }
  if (attempt.submittedAt) return { attemptId: attempt.id }

  // Re-check entitlement at submit: a subscription can lapse mid-attempt.
  const ent = await getEntitlements(user.id)
  if (!canAccessChapter(attempt.chapter, attempt.chapter.course, ent)) {
    return { error: 'You no longer have access to this chapter.' }
  }

  const questions = await prisma.question.findMany({
    where: { chapterId: attempt.chapterId },
    orderBy: { index: 'asc' },
    select: { id: true, kind: true, answer: true, marks: true },
  })

  const given: Record<string, string> = {}
  for (const q of questions) given[q.id] = String(formData.get(`q_${q.id}`) ?? '')

  const { score, maxScore, rows } = grade(questions, given)

  await prisma.$transaction([
    prisma.quizAnswer.deleteMany({ where: { attemptId: attempt.id } }),
    prisma.quizAnswer.createMany({
      data: rows.map((r) => ({ attemptId: attempt.id, ...r })),
    }),
    prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: { score, maxScore, submittedAt: new Date() },
    }),
  ])

  revalidatePath('/performance')
  return { attemptId: attempt.id }
}

export async function retakeQuiz(formData: FormData) {
  const user = await currentUser()
  if (!user) return
  const chapterId = String(formData.get('chapterId') ?? '')
  const chapter = await assertChapterAccess(user.id, chapterId)
  if (!chapter) return

  await prisma.quizAttempt.create({ data: { userId: user.id, chapterId } })
  revalidatePath(`/quiz/${chapterId}`)
}
