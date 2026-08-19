'use server'

import { revalidatePath } from 'next/cache'
import OpenAI from 'openai'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/admin'
import { hit } from '@/lib/rate-limit'
import { NAMING_SCHEMA, namingPrompt, parseNames } from '@/lib/naming'

export type AdminState = { error?: string; saved?: boolean }

/** Turns a thrown FORBIDDEN into a message instead of a stack trace. */
function guard(gate: () => Promise<unknown>) {
  return async function run<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
    try {
      await gate()
      return await fn()
    } catch (err) {
      if (err instanceof Error && err.message === 'FORBIDDEN') {
        return { error: 'You do not have permission to do that.' }
      }
      // A duplicate slug or index is a user mistake, not a server fault.
      if (err instanceof Error && err.message.includes('Unique constraint')) {
        return { error: 'Something with that name or position already exists.' }
      }
      console.error('[admin]', err)
      return { error: 'That did not work. Please try again.' }
    }
  }
}

/**
 * Everything in this file is teaching content, so it is staff-gated. Catalog
 * structure and roles are admin-gated and live in catalog-actions.ts.
 */
const asStaff = guard(requireStaff)

// ------------------------------------------------------------------- chapters

const ChapterInput = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(2, 'Give the chapter a title').max(200),
  index: z.coerce.number().int().min(1).max(999),
  isFree: z.boolean(),
  summary: z.string().trim().max(1000).optional(),
})

export async function saveChapter(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return (await asStaff(async () => {
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
  await asStaff(async () => {
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
  // Editable rather than fixed at the schema default: the AI course is built
  // from ACTIVITY topics, and until this was here every topic created through
  // the panel silently became a VIDEO.
  kind: z.enum(['VIDEO', 'ACTIVITY']),
  durationSec: z.coerce.number().int().min(0).max(60 * 60 * 12),
  videoUrl: z
    .union([z.url('Enter a full https:// URL'), z.literal('')])
    .transform((v) => v || null),
  posterUrl: z
    .union([z.url('Enter a full https:// URL for the poster'), z.literal('')])
    .transform((v) => v || null),
})

export async function saveTopic(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return (await asStaff(async () => {
    const id = String(formData.get('id') ?? '')
    const parsed = TopicInput.safeParse({
      chapterId: formData.get('chapterId'),
      title: formData.get('title'),
      index: formData.get('index'),
      kind: formData.get('kind') || 'VIDEO',
      durationSec: formData.get('durationSec') || 0,
      videoUrl: formData.get('videoUrl') ?? '',
      posterUrl: formData.get('posterUrl') ?? '',
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
  await asStaff(async () => {
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
  /// 1 easy, 2 medium, 3 hard — the column existed and nothing could set it,
  /// so every question written through the panel was marked easy.
  difficulty: z.coerce.number().int().min(1).max(3),
  marks: z.coerce.number().int().min(1).max(20),
})

export async function saveQuestion(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return (await asStaff(async () => {
    const id = String(formData.get('id') ?? '')
    const parsed = QuestionInput.safeParse({
      chapterId: formData.get('chapterId'),
      index: formData.get('index'),
      kind: formData.get('kind'),
      prompt: formData.get('prompt'),
      answer: formData.get('answer'),
      explanation: formData.get('explanation') || undefined,
      difficulty: formData.get('difficulty') || 1,
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
  await asStaff(async () => {
    const id = String(formData.get('id') ?? '')
    const question = await prisma.question.findUnique({ where: { id } })
    if (!question) return {}
    await prisma.question.delete({ where: { id } })
    revalidatePath(`/admin/chapter/${question.chapterId}`)
    return {}
  })
}

// ------------------------------------------------------- guided practice

/**
 * The material the guided tutor is allowed to answer from, and the answers the
 * client wants given word for word.
 *
 * Staff-gated like the rest of this file. Worth saying plainly what saving here
 * does: `content` is the entire world the guided tutor gets for this topic, so
 * pasting a page of notes both enables the mode and bounds it. Clearing the box
 * takes the topic off the guided-practice list — which is the intended way to
 * withdraw one, not a side effect.
 */
const TopicMaterialInput = z.object({
  topicId: z.string().min(1),
  // Deliberately uncapped: a topic's notes are as long as the client's notes
  // are, and a cap here reads as "your syllabus does not fit". The practical
  // ceiling is `serverActions.bodySizeLimit` in next.config.ts, raised to match.
  content: z.string().trim(),
  // The names shown beside the box. Both optional so an older client — or a
  // save made before the fields existed — still just saves the material.
  title: z.string().trim().min(2, 'Give the topic a name').max(200).optional(),
  chapterTitle: z.string().trim().min(2, 'Give the chapter a name').max(200).optional(),
})

export async function saveTopicMaterial(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  return (await asStaff(async () => {
    const parsed = TopicMaterialInput.safeParse({
      topicId: formData.get('topicId'),
      content: formData.get('content') ?? '',
      title: formData.get('title') || undefined,
      chapterTitle: formData.get('chapterTitle') || undefined,
    })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const topic = await prisma.topic.update({
      where: { id: parsed.data.topicId },
      data: {
        // Empty means "not offered", and null is how the rest of the code asks
        // that question. Storing "" instead would make a withdrawn topic look
        // enabled to every `content: { not: null }` filter.
        content: parsed.data.content || null,
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
      },
    })

    // The chapter is shared by every topic under it, so it is only written when
    // the name actually changed — otherwise a save of one topic's material
    // would touch a row the person saving was not editing.
    if (parsed.data.chapterTitle) {
      await prisma.chapter.updateMany({
        where: { id: topic.chapterId, NOT: { title: parsed.data.chapterTitle } },
        data: { title: parsed.data.chapterTitle },
      })
    }

    revalidatePath(`/admin/topic/${topic.id}`)
    revalidatePath(`/admin/chapter/${topic.chapterId}`)
    revalidatePath('/academic')
    revalidatePath('/guided')
    return { saved: true }
  })) as AdminState
}

/**
 * Names a topic and its chapter from the material that was just pasted.
 *
 * Called from the material editor as soon as there is something to read, and
 * again on demand from the button beside the names. It only ever *suggests*:
 * the two fields it fills are ordinary text inputs that the person uploading
 * can overwrite, and nothing is written to the database until they save.
 *
 * Staff-gated and rate-limited like everything else that spends model tokens.
 * Not charged against a student's credits or the tutor's daily budget — this is
 * authoring, and a teacher whose panel stopped naming things because students
 * had used the day's allowance would have no idea why.
 */
export type NameSuggestion = { error?: string; topicTitle?: string; chapterTitle?: string }

const NAMING_LIMIT = { max: 20, windowMs: 60_000 }
const NAMING_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

export async function suggestTopicNames(topicId: string, content: string): Promise<NameSuggestion> {
  return (await asStaff(async () => {
    const text = content.trim()
    // Short enough and there is nothing to read but a heading; naming from it
    // produces confident nonsense, which is worse than leaving the field alone.
    if (text.length < 120) {
      return { error: 'Paste a bit more before naming it.' }
    }
    if (!process.env.OPENAI_API_KEY) {
      return { error: 'Naming needs OPENAI_API_KEY on the server. Type the names in instead.' }
    }

    const staff = await requireStaff()
    const quota = await hit(`naming:u:${staff.id}`, NAMING_LIMIT.max, NAMING_LIMIT.windowMs)
    if (!quota.ok) return { error: 'Too many naming requests. Try again in a moment.' }

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        chapter: { include: { course: { include: { subject: true, classLevel: true } } } },
      },
    })
    if (!topic) return { error: 'That topic no longer exists.' }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    try {
      const completion = await openai.chat.completions.create({
        model: NAMING_MODEL,
        // Two short names, so the ceiling is small on purpose: this runs on
        // every paste and its cost has to stay a rounding error.
        max_completion_tokens: 120,
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'topic_names', strict: true, schema: NAMING_SCHEMA },
        },
        messages: [
          {
            role: 'system',
            content: namingPrompt({
              subject: topic.chapter.course.subject.name,
              classLabel: topic.chapter.course.classLevel.label,
              currentTopicTitle: topic.title,
              currentChapterTitle: topic.chapter.title,
              content: text,
            }),
          },
          { role: 'user', content: 'Name this material.' },
        ],
      })

      const names = parseNames(completion.choices[0]?.message?.content ?? '')
      if (!names) return { error: 'Could not name that one. Type the names in.' }
      return names
    } catch (err) {
      console.error('[admin] naming', err)
      return { error: 'The namer is unavailable right now. Type the names in.' }
    }
  })) as NameSuggestion
}

const TopicAnswerInput = z.object({
  topicId: z.string().min(1),
  index: z.coerce.number().int().min(1).max(999),
  question: z.string().trim().min(3, 'Write the question').max(1000),
  answer: z.string().trim().min(1, 'Write the answer the student should get').max(2000),
})

export async function saveTopicAnswer(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return (await asStaff(async () => {
    const id = String(formData.get('id') ?? '')
    const parsed = TopicAnswerInput.safeParse({
      topicId: formData.get('topicId'),
      index: formData.get('index'),
      question: formData.get('question'),
      answer: formData.get('answer'),
    })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    // One step per line, blank lines dropped. Leaving the box empty hands the
    // steps back to the model — the answer stays exact either way.
    const steps = String(formData.get('steps') ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    const clash = await prisma.topicAnswer.findFirst({
      where: {
        topicId: parsed.data.topicId,
        index: parsed.data.index,
        ...(id ? { NOT: { id } } : {}),
      },
    })
    if (clash) return { error: `Answer ${parsed.data.index} already exists for this topic.` }

    const data = { ...parsed.data, steps }
    if (id) {
      await prisma.topicAnswer.update({ where: { id }, data })
    } else {
      await prisma.topicAnswer.create({ data })
    }

    revalidatePath(`/admin/topic/${parsed.data.topicId}`)
    return { saved: true }
  })) as AdminState
}

export async function deleteTopicAnswer(formData: FormData) {
  await asStaff(async () => {
    const id = String(formData.get('id') ?? '')
    const entry = await prisma.topicAnswer.findUnique({ where: { id } })
    if (!entry) return {}
    await prisma.topicAnswer.delete({ where: { id } })
    revalidatePath(`/admin/topic/${entry.topicId}`)
    return {}
  })
}
