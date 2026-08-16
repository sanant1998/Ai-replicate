import 'server-only'
import { prisma } from '@/lib/prisma'

function utcMidnight(d = new Date()) {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

/**
 * What an account with an unconfirmed address gets per day.
 *
 * Signup is free and instant, so the daily allowance is only a real cost
 * control while one person cannot cheaply hold many accounts. Requiring a
 * reachable address is the cheapest thing that makes minting the tenth account
 * meaningfully harder than the first. It is a reduction rather than a block
 * because the students are children: some will mistype an address, and some
 * will not control the inbox they gave us.
 */
export const UNVERIFIED_CREDIT_CAP = 2

/** The allowance a free account is created with (schema default on User). */
const FREE_CREDIT_CAP = 5

/**
 * The cap actually applied today, after the verification discount.
 *
 * A raised cap only ever comes from `grantForPayment`, so a cap above the free
 * default means this account has paid — and someone who paid has no incentive
 * to farm free allowances. Throttling them over an unread confirmation mail
 * would be punishing the wrong person, so purchases opt out.
 */
export function effectiveCreditCap(user: {
  dailyCreditCap: number
  emailVerifiedAt: Date | null
}): number {
  if (user.emailVerifiedAt) return user.dailyCreditCap
  if (user.dailyCreditCap > FREE_CREDIT_CAP) return user.dailyCreditCap
  return Math.min(user.dailyCreditCap, UNVERIFIED_CREDIT_CAP)
}

/**
 * Tops a user back up to their daily cap the first time they're seen each UTC day.
 * Idempotent: safe to call on every request.
 */
export async function ensureDailyCredits(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const today = utcMidnight()

  if (user.creditsGrantedOn && user.creditsGrantedOn.getTime() >= today.getTime()) {
    return user
  }

  const cap = effectiveCreditCap(user)
  const delta = cap - user.dailyCredits
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { dailyCredits: cap, creditsGrantedOn: today },
    }),
    ...(delta !== 0
      ? [
          prisma.creditLedger.create({
            data: { userId, delta, reason: 'DAILY_GRANT' as const, note: 'Daily reset' },
          }),
        ]
      : []),
  ])
  return updated
}

/**
 * Spends one credit. Returns false when the user is out for the day.
 * Uses a conditional update so two concurrent requests can't both take the last credit.
 */
export async function spendCredit(userId: string, note?: string): Promise<boolean> {
  await ensureDailyCredits(userId)

  const { count } = await prisma.user.updateMany({
    where: { id: userId, dailyCredits: { gt: 0 } },
    data: { dailyCredits: { decrement: 1 } },
  })
  if (count === 0) return false

  await prisma.creditLedger.create({
    data: { userId, delta: -1, reason: 'TUTOR_MESSAGE', note },
  })
  return true
}
