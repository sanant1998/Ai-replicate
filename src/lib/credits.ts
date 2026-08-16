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
 * A ceiling on how many model calls the whole deployment may make in one UTC
 * day, across every account.
 *
 * The per-account cap bounds what one student costs. It does not bound what the
 * site costs, because signup is free: mint accounts and the bill scales with
 * them. The usual answer is a spend limit on the provider account, and that is
 * still the better one — it is enforced by the party holding the money. This
 * exists for the deployment that cannot set one, and it is the only thing
 * standing between an account-farming script and an unbounded invoice.
 *
 * Measured in requests rather than tokens because requests are what we can
 * count without trusting the provider's accounting to arrive in time. With
 * `max_completion_tokens` capped at 1500 in the tutor route, a request has a
 * known worst case, so a request ceiling is a spend ceiling.
 *
 * Set TUTOR_DAILY_LIMIT to tune it. Explicitly `0` removes the ceiling, for a
 * deployment that has a real provider-side budget and would rather not have two.
 */
const DEFAULT_DAILY_TUTOR_LIMIT = 200

export function dailyTutorLimit(): number {
  const raw = process.env.TUTOR_DAILY_LIMIT
  if (raw === undefined || raw.trim() === '') return DEFAULT_DAILY_TUTOR_LIMIT
  const parsed = Number(raw)
  // A typo must not silently uncap the budget — fall back to the default.
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_DAILY_TUTOR_LIMIT
  return Math.floor(parsed)
}

/**
 * Whether today's deployment-wide allowance is already gone.
 *
 * Counts spends, not refunds: a request that failed and was refunded may still
 * have cost tokens before it failed, and a budget that forgives its own
 * failures is not a budget.
 */
export async function tutorBudgetExhausted(): Promise<boolean> {
  const limit = dailyTutorLimit()
  if (limit === 0) return false

  const usedToday = await prisma.creditLedger.count({
    where: { reason: 'TUTOR_MESSAGE', createdAt: { gte: utcMidnight() } },
  })
  return usedToday >= limit
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

/**
 * Hands a spent credit back when the answer it paid for never arrived.
 *
 * The tutor charges before calling the model, because that is the only order
 * that stops two parallel requests spending the same last credit. The price of
 * that is a student losing a credit whenever OpenAI is down — which is exactly
 * when they are least inclined to forgive it. This closes the loop.
 *
 * Deliberately allowed to exceed the day's cap: the credit was already granted
 * once, and clamping here would quietly keep it. The ledger records both legs,
 * so the balance stays explicable.
 */
export async function refundCredit(userId: string, note?: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { dailyCredits: { increment: 1 } },
  })
  await prisma.creditLedger.create({
    data: { userId, delta: 1, reason: 'MANUAL_ADJUSTMENT', note: note ?? 'Tutor request failed' },
  })
}
