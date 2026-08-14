import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'

const TTL_MS = 60 * 60 * 1000 // one hour

/** Tokens are stored as a hash; the raw value only ever exists in the email. */
export function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

export async function issueResetToken(userId: string) {
  const raw = randomBytes(32).toString('base64url')

  // One live token per user: issuing a new link invalidates any older one.
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  })

  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  })

  return raw
}

/** Returns the userId when the token is live, or null for spent/expired/unknown. */
export async function consumeResetToken(raw: string): Promise<string | null> {
  const candidate = hashToken(raw)
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: candidate } })
  if (!row || row.usedAt || row.expiresAt < new Date()) return null

  // Constant-time compare so a partial-match oracle can't be built from timing.
  const a = Buffer.from(candidate)
  const b = Buffer.from(row.tokenHash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const { count } = await prisma.passwordResetToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  // count === 0 means another request consumed it first.
  return count === 1 ? row.userId : null
}
