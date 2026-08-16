import 'server-only'
import { currentUser } from '@/lib/session'

/**
 * Two staff roles, deliberately separated:
 *
 *   TEACHER — authors what students learn from: courses, chapters, topics and
 *             exam questions.
 *   ADMIN   — all of that, plus the catalog structure every course hangs off
 *             (classes and subjects) and everyone's role.
 *
 * The distinction matters because classes, subjects and roles are shared state:
 * a teacher renaming "Class - 8th" or promoting themselves would affect every
 * other teacher and every student.
 *
 * Role is read from the user row rather than the session cookie, so demoting
 * someone takes effect on their next request instead of whenever their token
 * happens to expire.
 */
export type StaffUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>

export async function requireAdmin(): Promise<StaffUser> {
  const user = await currentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('FORBIDDEN')
  return user
}

/** Anyone who may edit teaching content: TEACHER or ADMIN. */
export async function requireStaff(): Promise<StaffUser> {
  const user = await currentUser()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'TEACHER')) throw new Error('FORBIDDEN')
  return user
}

export async function isAdmin() {
  const user = await currentUser()
  return user?.role === 'ADMIN'
}

export async function isStaff() {
  const user = await currentUser()
  return user?.role === 'ADMIN' || user?.role === 'TEACHER'
}
