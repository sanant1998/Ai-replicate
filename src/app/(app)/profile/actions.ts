'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { isUnauthenticated, requireUser, SIGNED_OUT_MESSAGE } from '@/lib/session'
import { isLanguageTag } from '@/lib/language'

export type ProfileState = { error?: string; saved?: boolean }

/**
 * Moves the student to a different board/class. Subscriptions are deliberately
 * left alone — they are scoped to the class that was paid for, so switching
 * class does not carry access across, and switching back restores it.
 */
export async function updateClass(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    if (isUnauthenticated(err)) return { error: SIGNED_OUT_MESSAGE }
    throw err
  }

  const classLevelId = String(formData.get('classLevelId') ?? '')
  if (!classLevelId) return { error: 'Choose a class' }

  const classLevel = await prisma.classLevel.findUnique({ where: { id: classLevelId } })
  if (!classLevel) return { error: 'That class no longer exists' }

  const boardId = String(formData.get('boardId') ?? '')
  if (boardId && classLevel.boardId !== boardId) {
    return { error: 'That class does not belong to the chosen board' }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { boardId: classLevel.boardId, classLevelId: classLevel.id },
  })

  revalidatePath('/academic', 'layout')
  revalidatePath('/profile')
  return { saved: true }
}

/**
 * The language the AI tutor answers in.
 *
 * Scoped deliberately: the interface stays in English. A half-translated UI is
 * worse than an English one, and nobody on this project can proofread Marathi —
 * whereas a model answering a question in the language the student thinks in is
 * the part that decides whether they understand the answer.
 */
export async function updateLanguage(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    if (isUnauthenticated(err)) return { error: SIGNED_OUT_MESSAGE }
    throw err
  }

  const language = String(formData.get('language') ?? '')
  if (!isLanguageTag(language)) return { error: 'Pick one of the listed languages' }

  await prisma.user.update({ where: { id: user.id }, data: { language } })

  // The <html lang> attribute is set in the root layout, so the whole tree has
  // to be revalidated rather than just this page.
  revalidatePath('/', 'layout')
  return { saved: true }
}
