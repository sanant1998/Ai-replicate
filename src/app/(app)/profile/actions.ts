'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { isUnauthenticated, requireUser, SIGNED_OUT_MESSAGE } from '@/lib/session'

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
