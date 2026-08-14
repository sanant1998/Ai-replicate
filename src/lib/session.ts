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

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
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

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    return { uid: String(payload.uid), email: String(payload.email) }
  } catch {
    return null
  }
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
