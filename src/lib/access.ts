import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Entitlement rules, in one place:
 *   1. Chapter 1 of every course is free to everyone (including logged-out visitors).
 *   2. A CLASS-scoped active subscription unlocks every course in that class.
 *   3. A COURSE-scoped active subscription unlocks that one course.
 */
export type Entitlements = {
  classLevelIds: Set<string>
  courseIds: Set<string>
}

export async function getEntitlements(userId: string | null): Promise<Entitlements> {
  if (!userId) return { classLevelIds: new Set(), courseIds: new Set() }

  const subs = await prisma.subscription.findMany({
    where: { userId, status: 'ACTIVE', endsAt: { gt: new Date() } },
    select: { scope: true, courseId: true, classLevelId: true },
  })

  const classLevelIds = new Set<string>()
  const courseIds = new Set<string>()
  for (const s of subs) {
    if (s.scope === 'CLASS' && s.classLevelId) classLevelIds.add(s.classLevelId)
    if (s.scope === 'COURSE' && s.courseId) courseIds.add(s.courseId)
  }
  return { classLevelIds, courseIds }
}

export function canAccessChapter(
  chapter: { isFree: boolean; courseId: string },
  course: { classLevelId: string },
  ent: Entitlements,
): boolean {
  if (chapter.isFree) return true
  if (ent.classLevelIds.has(course.classLevelId)) return true
  return ent.courseIds.has(chapter.courseId)
}

/** Server-side guard used by the player and the tutor route. */
export async function assertTopicAccess(topicId: string, userId: string | null) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { chapter: { include: { course: true } } },
  })
  if (!topic) return { ok: false as const, reason: 'NOT_FOUND' as const, topic: null }

  const ent = await getEntitlements(userId)
  const ok = canAccessChapter(topic.chapter, topic.chapter.course, ent)
  return ok
    ? ({ ok: true as const, topic } as const)
    : ({ ok: false as const, reason: 'LOCKED' as const, topic } as const)
}
