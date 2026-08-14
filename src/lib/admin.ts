import 'server-only'
import { currentUser } from '@/lib/session'

/**
 * Every admin page and every admin action calls this. Role lives on the user
 * row, not on the session cookie, so demoting someone takes effect on their
 * next request rather than whenever their token happens to expire.
 */
export async function requireAdmin() {
  const user = await currentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('FORBIDDEN')
  return user
}

export async function isAdmin() {
  const user = await currentUser()
  return user?.role === 'ADMIN'
}
