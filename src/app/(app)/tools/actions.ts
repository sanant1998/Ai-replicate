'use server'

import { prisma } from '@/lib/prisma'
import { isUnauthenticated, requireUser, SIGNED_OUT_MESSAGE } from '@/lib/session'
import { canAccessChapter, getEntitlements } from '@/lib/access'
import { spendCredit } from '@/lib/credits'
import { AiUnavailable, completeJson, completeText } from '@/lib/ai'
import { hit } from '@/lib/rate-limit'

export type ToolState<T> = { error?: string; result?: T }

/** Everything here costs a credit and needs the chapter to be unlocked. */
async function guard(chapterId: string, note: string) {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    if (isUnauthenticated(err)) return { error: SIGNED_OUT_MESSAGE as string }
    throw err
  }

  const burst = hit(`tools:${user.id}`, 10, 60_000)
  if (!burst.ok) return { error: 'You are generating too quickly. Try again in a minute.' as const }

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { course: { include: { subject: true, classLevel: true } }, topics: { orderBy: { index: 'asc' } } },
  })
  if (!chapter) return { error: 'Pick a chapter first.' as const }

  const ent = await getEntitlements(user.id)
  if (!canAccessChapter(chapter, chapter.course, ent)) {
    return { error: 'You do not have access to that chapter.' as const }
  }

  const paid = await spendCredit(user.id, note)
  if (!paid) return { error: 'You have used all of today’s credits. They reset at midnight UTC.' as const }

  return { user, chapter }
}

function chapterContext(chapter: {
  index: number
  title: string
  course: { subject: { name: string }; classLevel: { label: string } }
  topics: { title: string }[]
}) {
  return [
    `Subject: ${chapter.course.subject.name}`,
    `Class: ${chapter.course.classLevel.label}`,
    `Chapter ${chapter.index}: ${chapter.title}`,
    `Topics: ${chapter.topics.map((t) => t.title).join('; ')}`,
  ].join('\n')
}

// ---------------------------------------------------------------- formula sheet

export async function generateFormulaSheet(
  _prev: ToolState<string>,
  formData: FormData,
): Promise<ToolState<string>> {
  const g = await guard(String(formData.get('chapterId') ?? ''), 'Tool: formula sheet')
  if ('error' in g) return { error: g.error }

  try {
    const result = await completeText({
      system: [
        'You produce one-page revision sheets for Indian school students.',
        'Output plain Markdown: a short heading, then grouped bullet points.',
        'Include every formula, definition and standard result the chapter needs, and nothing from outside it.',
        'Write mathematics in LaTeX between $ delimiters.',
        'No preamble, no closing remarks — the sheet only.',
      ].join('\n'),
      prompt: `Write the revision sheet for this chapter.\n\n${chapterContext(g.chapter)}`,
      maxTokens: 2000,
    })
    return { result }
  } catch (err) {
    return { error: message(err) }
  }
}

// ------------------------------------------------------------ practice generator

export type PracticeQuestion = {
  question: string
  answer: string
  working: string
}

export async function generatePractice(
  _prev: ToolState<PracticeQuestion[]>,
  formData: FormData,
): Promise<ToolState<PracticeQuestion[]>> {
  const g = await guard(String(formData.get('chapterId') ?? ''), 'Tool: practice questions')
  if ('error' in g) return { error: g.error }

  const level = ['easy', 'medium', 'hard'].includes(String(formData.get('level')))
    ? String(formData.get('level'))
    : 'medium'

  try {
    const result = await completeJson<PracticeQuestion[]>({
      system: [
        'You write practice questions for Indian school students, in the style of their board exam.',
        'Return a JSON array of exactly 5 objects with keys: question, answer, working.',
        '"working" is the full step-by-step solution. "answer" is the final result on its own.',
        'Stay strictly inside the chapter given. Write mathematics in LaTeX between $ delimiters.',
      ].join('\n'),
      prompt: `Difficulty: ${level}.\n\n${chapterContext(g.chapter)}`,
      maxTokens: 3000,
    })

    if (!Array.isArray(result) || result.length === 0) {
      return { error: 'The generator returned nothing usable. Try again.' }
    }
    return { result }
  } catch (err) {
    return { error: message(err) }
  }
}

// ---------------------------------------------------------------- doubt scanner

export async function explainDoubt(
  _prev: ToolState<string>,
  formData: FormData,
): Promise<ToolState<string>> {
  const question = String(formData.get('question') ?? '').trim()
  if (question.length < 5) return { error: 'Type out the question you are stuck on.' }
  if (question.length > 2000) return { error: 'That is too long — paste just the question.' }

  const g = await guard(String(formData.get('chapterId') ?? ''), 'Tool: doubt scanner')
  if ('error' in g) return { error: g.error }

  try {
    const result = await completeText({
      system: [
        'You explain a single question a student is stuck on, for Indian school students.',
        'Structure the reply as Markdown: **What it is asking**, **How to approach it**, **Worked solution**, **The trap**.',
        'Work through it fully — this is a doubt the student has already attempted, not homework you are doing for them.',
        'Write mathematics in LaTeX between $ delimiters.',
      ].join('\n'),
      prompt: `${chapterContext(g.chapter)}\n\nThe student is stuck on:\n${question}`,
      maxTokens: 2000,
    })
    return { result }
  } catch (err) {
    return { error: message(err) }
  }
}

function message(err: unknown) {
  if (err instanceof AiUnavailable) {
    return 'The AI tools are not configured on this server yet.'
  }
  console.error('[tools]', err)
  return 'That did not work. Please try again.'
}
