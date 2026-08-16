import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'

/**
 * Email confirmation tokens.
 *
 * Deliberately the same shape as lib/reset.ts — hashed at rest, single use,
 * time limited, one live token per user — because the threat is the same: the
 * raw value is a bearer credential that travels through email, so the database
 * must never hold anything replayable.
 *
 * The window is long. A reset link is a response to something the user just
 * did, but a confirmation mail can sit unread until a parent opens it on the
 * family phone that evening, so an hour would mostly generate support tickets.
 */
const TTL_MS = 24 * 60 * 60 * 1000

export function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

export async function issueVerificationToken(userId: string) {
  const raw = randomBytes(32).toString('base64url')

  // Issuing a new link retires any older one, so a forwarded old mail is dead.
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  })

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  })

  return raw
}

/** Returns the userId when the token is live, or null for spent/expired/unknown. */
export async function consumeVerificationToken(raw: string): Promise<string | null> {
  const candidate = hashToken(raw)
  const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: candidate } })
  if (!row || row.usedAt || row.expiresAt < new Date()) return null

  // Constant-time compare so a partial-match oracle can't be built from timing.
  const a = Buffer.from(candidate)
  const b = Buffer.from(row.tokenHash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const { count } = await prisma.emailVerificationToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  // count === 0 means another request consumed it first.
  return count === 1 ? row.userId : null
}
