'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { currentUser, isUnauthenticated, requireUser, SIGNED_OUT_MESSAGE } from '@/lib/session'
import { assertTopicAccess, canAccessChapter, getEntitlements } from '@/lib/access'
import { hit } from '@/lib/rate-limit'

export type NoteState = { error?: string; saved?: boolean }

const NoteInput = z.object({
  topicId: z.string().min(1),
  body: z.string().trim().min(1, 'Write something first').max(2000, 'That note is too long'),
  atSec: z.coerce.number().int().min(0).max(60 * 60 * 12).default(0),
})

export async function addNote(_prev: NoteState, formData: FormData): Promise<NoteState> {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    if (isUnauthenticated(err)) return { error: SIGNED_OUT_MESSAGE }
    throw err
  }

  const burst = hit(`note:${user.id}`, 30, 60_000)
  if (!burst.ok) return { error: 'Slow down a moment.' }

  const parsed = NoteInput.safeParse({
    topicId: formData.get('topicId'),
    body: formData.get('body'),
    atSec: formData.get('atSec') ?? 0,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Notes are attached to a lesson, so they need the same gate as the lesson.
  const access = await assertTopicAccess(parsed.data.topicId, user.id)
  if (!access.ok) return { error: 'You do not have access to this lesson.' }

  await prisma.note.create({
    data: {
      userId: user.id,
      topicId: parsed.data.topicId,
      body: parsed.data.body,
      atSec: parsed.data.atSec,
    },
  })

  revalidatePath(`/learn/${parsed.data.topicId}`)
  revalidatePath('/notes')
  return { saved: true }
}

export async function deleteNote(formData: FormData) {
  // Void actions have nowhere to show an error, so an expired session is a
  // silent no-op rather than a 500 the user cannot act on.
  const user = await currentUser()
  if (!user) return
  const id = String(formData.get('id') ?? '')

  // Scoped delete: a forged id belonging to someone else matches nothing.
  const note = await prisma.note.findFirst({ where: { id, userId: user.id } })
  if (!note) return

  await prisma.note.delete({ where: { id: note.id } })
  revalidatePath(`/learn/${note.topicId}`)
  revalidatePath('/notes')
}

export async function toggleBookmark(formData: FormData) {
  const user = await currentUser()
  if (!user) return
  const chapterId = String(formData.get('chapterId') ?? '')

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { course: true },
  })
  if (!chapter) return

  const ent = await getEntitlements(user.id)
  if (!canAccessChapter(chapter, chapter.course, ent)) return

  const existing = await prisma.bookmark.findUnique({
    where: { userId_chapterId: { userId: user.id, chapterId } },
  })

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } })
  } else {
    await prisma.bookmark.create({ data: { userId: user.id, chapterId } })
  }

  revalidatePath('/academic')
  revalidatePath('/notes')
  const from = String(formData.get('from') ?? '')
  if (from) revalidatePath(from)
}
