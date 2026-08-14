'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'

export type AdminState = { error?: string; saved?: boolean }

/** Wraps an action so a non-admin gets a message instead of a stack trace. */
async function asAdmin<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    await requireAdmin()
    return await fn()
  } catch (err) {
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return { error: 'You do not have permission to do that.' }
    }
    console.error('[admin]', err)
    return { error: 'That did not work. Please try again.' }
  }
}

// ------------------------------------------------------------------- chapters

const ChapterInput = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(2, 'Give the chapter a title').max(200),
  index: z.coerce.number().int().min(1).max(999),
  isFree: z.boolean(),
  summary: z.string().trim().max(1000).optional(),
})

export async function saveChapter(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return (await asAdmin(async () => {
    const id = String(formData.get('id') ?? '')
    const parsed = ChapterInput.safeParse({
      courseId: formData.get('courseId'),
      title: formData.get('title'),
      index: formData.get('index'),
      isFree: formData.get('isFree') === 'on',
      summary: formData.get('summary') || undefined,
    })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    // (courseId, index) is unique — say so plainly rather than leaking a
    // Prisma constraint error to the page.
    const clash = await prisma.chapter.findFirst({
      where: { courseId: parsed.data.courseId, index: parsed.data.index, ...(id ? { NOT: { id } } : {}) },
    })
    if (clash) return { error: `Chapter ${parsed.data.index} already exists in this course.` }

    if (id) {
      await prisma.chapter.update({ where: { id }, data: parsed.data })
    } else {
      await prisma.chapter.create({ data: parsed.data })
    }

    revalidatePath(`/admin/course/${parsed.data.courseId}`)
    revalidatePath('/academic')
    return { saved: true }
  })) as AdminState
}

export async function deleteChapter(formData: FormData) {
  await asAdmin(async () => {
    const id = String(formData.get('id') ?? '')
    const chapter = await prisma.chapter.findUnique({ where: { id } })
    if (!chapter) return {}

    // Cascades to topics, questions, attempts and bookmarks by schema.
    await prisma.chapter.delete({ where: { id } })
    revalidatePath(`/admin/course/${chapter.courseId}`)
    revalidatePath('/academic')
    return {}
  })
}

// --------------------------------------------------------------------- topics

const TopicInput = z.object({
  chapterId: z.string().min(1),
  title: z.string().trim().min(2, 'Give the topic a title').max(200),
  index: z.coerce.number().int().min(1).max(999),
  durationSec: z.coerce.number().int().min(0).max(60 * 60 * 12),
  videoUrl: z
    .union([z.url('Enter a full https:// URL'), z.literal('')])
    .transform((v) => v || null),
})

export async function saveTopic(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return (await asAdmin(async () => {
    const id = String(formData.get('id') ?? '')
    const parsed = TopicInput.safeParse({
      chapterId: formData.get('chapterId'),
      title: formData.get('title'),
      index: formData.get('index'),
      durationSec: formData.get('durationSec') || 0,
      videoUrl: formData.get('videoUrl') ?? '',
    })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const clash = await prisma.topic.findFirst({
      where: { chapterId: parsed.data.chapterId, index: parsed.data.index, ...(id ? { NOT: { id } } : {}) },
    })
    if (clash) return { error: `Topic ${parsed.data.index} already exists in this chapter.` }

    if (id) {
      await prisma.topic.update({ where: { id }, data: parsed.data })
    } else {
      await prisma.topic.create({ data: parsed.data })
    }

    revalidatePath(`/admin/chapter/${parsed.data.chapterId}`)
    revalidatePath('/academic')
    return { saved: true }
  })) as AdminState
}

export async function deleteTopic(formData: FormData) {
  await asAdmin(async () => {
    const id = String(formData.get('id') ?? '')
    const topic = await prisma.topic.findUnique({ where: { id } })
    if (!topic) return {}
    await prisma.topic.delete({ where: { id } })
    revalidatePath(`/admin/chapter/${topic.chapterId}`)
    return {}
  })
}

// ------------------------------------------------------------------ questions

const QuestionInput = z.object({
  chapterId: z.string().min(1),
  index: z.coerce.number().int().min(1).max(999),
  kind: z.enum(['MCQ', 'NUMERIC', 'SHORT']),
  prompt: z.string().trim().min(5, 'Write the question').max(1000),
  answer: z.string().trim().min(1, 'Give the correct answer').max(500),
  explanation: z.string().trim().max(1000).optional(),
  marks: z.coerce.number().int().min(1).max(20),
})

export async function saveQuestion(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return (await asAdmin(async () => {
    const id = String(formData.get('id') ?? '')
    const parsed = QuestionInput.safeParse({
      chapterId: formData.get('chapterId'),
      index: formData.get('index'),
      kind: formData.get('kind'),
      prompt: formData.get('prompt'),
      answer: formData.get('answer'),
      explanation: formData.get('explanation') || undefined,
      marks: formData.get('marks') || 1,
    })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    // One option per line in the textarea.
    const options = String(formData.get('options') ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    if (parsed.data.kind === 'MCQ') {
      if (options.length < 2) return { error: 'An MCQ needs at least two options.' }
      const answerIndex = Number(parsed.data.answer)
      if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
        return { error: `For an MCQ the answer must be an option number from 0 to ${options.length - 1}.` }
      }
    }

    const clash = await prisma.question.findFirst({
      where: { chapterId: parsed.data.chapterId, index: parsed.data.index, ...(id ? { NOT: { id } } : {}) },
    })
    if (clash) return { error: `Question ${parsed.data.index} already exists in this chapter.` }

    const data = { ...parsed.data, options: parsed.data.kind === 'MCQ' ? options : [] }

    if (id) {
      await prisma.question.update({ where: { id }, data })
    } else {
      await prisma.question.create({ data })
    }

    revalidatePath(`/admin/chapter/${parsed.data.chapterId}`)
    revalidatePath(`/quiz/${parsed.data.chapterId}`)
    return { saved: true }
  })) as AdminState
}

export async function deleteQuestion(formData: FormData) {
  await asAdmin(async () => {
    const id = String(formData.get('id') ?? '')
    const question = await prisma.question.findUnique({ where: { id } })
    if (!question) return {}
    await prisma.question.delete({ where: { id } })
    revalidatePath(`/admin/chapter/${question.chapterId}`)
    return {}
  })
}
