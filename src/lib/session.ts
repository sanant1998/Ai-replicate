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

/**
 * The revocation check lives here rather than in currentUser(), because this is
 * the only chokepoint every caller shares. Pages that need just a user id —
 * /notes, /history, /performance, /api/tutor — call readSession() and nothing
 * else, so a check further up would leave a revoked cookie working on exactly
 * the pages that hold a student's own data.
 *
 * The cost is one indexed lookup per authenticated request. Every caller
 * queries the user immediately afterwards anyway.
 */
export async function readSession(): Promise<Session | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null

  let claims: Session
  try {
    const { payload } = await jwtVerify(token, secret())
    // Cookies minted before token versioning carry no `tv`; treat them as 0,
    // which is the column default, so existing sessions keep working.
    claims = {
      uid: String(payload.uid),
      email: String(payload.email),
      tv: Number(payload.tv ?? 0),
    }
  } catch {
    return null
  }

  const account = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { tokenVersion: true },
  })
  // Deleted account, or a cookie signed before the last revocation: the
  // signature and expiry still check out, but the session is over.
  if (!account || account.tokenVersion !== claims.tv) return null

  return claims
}

/** Full user record for the current session, or null. */
export async function currentUser() {
  const s = await readSession()
  if (!s) return null
  return prisma.user.findUnique({
    where: { id: s.uid },
    include: { board: true, classLevel: true },
  })
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
