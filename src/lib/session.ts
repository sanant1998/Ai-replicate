import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'

const COOKIE = 'paperpath_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function secret() {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set. Generate one with: openssl rand -base64 32')
  return new TextEncoder().encode(s)
}

export type SessionPayload = { uid: string; email: string }
/** What is actually inside the cookie: the payload plus the token version. */
export type Session = SessionPayload & { tv: number }

export async function createSession(payload: SessionPayload) {
  // The account's current token version is stamped into the cookie so
  // revokeAllSessions() can invalidate every cookie minted before it. Read here
  // rather than passed in, so a caller cannot forget and silently break
  // revocation.
  const account = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: { tokenVersion: true },
  })

  const token = await new SignJWT({ ...payload, tv: account?.tokenVersion ?? 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret())

  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function destroySession() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    // Cookies minted before token versioning carry no `tv`; treat them as 0,
    // which is the column default, so existing sessions keep working.
    return {
      uid: String(payload.uid),
      email: String(payload.email),
      tv: Number(payload.tv ?? 0),
    }
  } catch {
    return null
  }
}

/** Full user record for the current session, or null. */
export async function currentUser() {
  const s = await readSession()
  if (!s) return null
  const user = await prisma.user.findUnique({
    where: { id: s.uid },
    include: { board: true, classLevel: true },
  })
  // A cookie issued before the last revocation is no longer a valid session,
  // even though its signature and expiry still check out.
  if (!user || user.tokenVersion !== s.tv) return null
  return user
}

/**
 * Invalidates every session for an account by moving its token version on.
 * Used after a password reset: whoever else held a cookie loses it.
 */
export async function revokeAllSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  })
}

export async function requireUser() {
  const user = await currentUser()
  if (!user) throw new Unauthenticated()
  return user
}

/**
 * Thrown by requireUser(). Server actions that render a result should catch it
 * via `signedOut()` and return a message — an uncaught throw inside an action
 * surfaces as a 500 and a client-side React crash, which is what a session
 * expiring between page load and button click would otherwise look like.
 */
export class Unauthenticated extends Error {
  constructor() {
    super('UNAUTHENTICATED')
    this.name = 'Unauthenticated'
  }
}

export function isUnauthenticated(err: unknown) {
  return err instanceof Unauthenticated || (err instanceof Error && err.message === 'UNAUTHENTICATED')
}

export const SIGNED_OUT_MESSAGE = 'Your session has expired. Please sign in again.'
