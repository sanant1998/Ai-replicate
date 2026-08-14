import 'server-only'
import { prisma } from '@/lib/prisma'

function utcMidnight(d = new Date()) {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
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

  const delta = user.dailyCreditCap - user.dailyCredits
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { dailyCredits: user.dailyCreditCap, creditsGrantedOn: today },
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
