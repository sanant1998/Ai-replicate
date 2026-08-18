import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'

/**
 * Parent/guardian consent tokens.
 *
 * Deliberately the same shape as lib/reset.ts and lib/verify-email.ts — hashed
 * at rest, single use, one live token per child — because the threat is
 * identical: the raw value is a bearer credential that travels through email.
 *
 * The window is long. A consent mail is read by an adult who was not at the
 * keyboard when the account was made, often that evening on a different device;
 * an hour would generate nothing but expired links.
 */
const TTL_MS = 14 * 24 * 60 * 60 * 1000

export function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}

export async function issueGuardianToken(userId: string) {
  const raw = randomBytes(32).toString('base64url')

  // Issuing a new link retires any older one, so a forwarded old mail is dead.
  await prisma.guardianConsentToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  })

  await prisma.guardianConsentToken.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + TTL_MS) },
  })

  return raw
}

/**
 * Looks a token up without spending it, so the consent page can show the parent
 * who they are consenting for before they decide. Spending happens only when
 * they actually press the button.
 */
export async function peekGuardianToken(raw: string) {
  const row = await prisma.guardianConsentToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          guardianEmail: true,
          guardianConsentAt: true,
          classLevel: { select: { label: true } },
        },
      },
    },
  })
  if (!row || row.usedAt || row.expiresAt < new Date()) return null
  return row
}

/** Returns the child's userId when the token is live, or null. */
export async function consumeGuardianToken(raw: string): Promise<string | null> {
  const candidate = hashToken(raw)
  const row = await prisma.guardianConsentToken.findUnique({ where: { tokenHash: candidate } })
  if (!row || row.usedAt || row.expiresAt < new Date()) return null

  // Constant-time compare so a partial-match oracle can't be built from timing.
  const a = Buffer.from(candidate)
  const b = Buffer.from(row.tokenHash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const { count } = await prisma.guardianConsentToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  // count === 0 means another request consumed it first.
  return count === 1 ? row.userId : null
}
