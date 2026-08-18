'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'

/**
 * Throws away this account's guided conversation about one topic.
 *
 * Needed more often than it looks. The material behind a topic changes while
 * people are testing it, and every answer already in the transcript was given
 * under the old material — so a screen full of "that is outside this topic"
 * survives the edit that fixed it, and reads as the fix not having worked. It
 * is also the only way to get the empty-state suggestions back.
 *
 * Scoped to the caller and to GUIDED, so this can never reach someone else's
 * chat or a tutor session. Messages go with the session by cascade.
 */
export async function clearGuidedChat(topicId: string): Promise<{ ok: boolean }> {
  const session = await readSession()
  if (!session) return { ok: false }

  await prisma.chatSession.deleteMany({
    where: { userId: session.uid, mode: 'GUIDED', topicId },
  })

  revalidatePath(`/guided/${topicId}`)
  return { ok: true }
}
