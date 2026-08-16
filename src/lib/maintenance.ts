import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * The periodic tidy-up nothing else does.
 *
 * None of this changes what a user can reach — `getEntitlements` compares
 * `endsAt` against the clock on every request, so access is already correct
 * whatever the `status` column says. What it fixes is everything that reads
 * those columns instead: an admin list, a revenue count, a "how many active
 * subscribers" query. Left alone they drift, and the drift is invisible until
 * someone makes a decision on it.
 */
export type MaintenanceReport = {
  subscriptionsExpired: number
  checkoutsAbandoned: number
  tokensPurged: number
}

/** How long a CREATED payment can sit before we call the checkout abandoned. */
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000

/** How long spent and expired tokens are kept for audit before deletion. */
const TOKEN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export async function runMaintenance(): Promise<MaintenanceReport> {
  const now = new Date()
  const abandonedBefore = new Date(now.getTime() - ABANDONED_AFTER_MS)
  const purgeBefore = new Date(now.getTime() - TOKEN_RETENTION_MS)

  const subscriptions = await prisma.subscription.updateMany({
    where: { status: 'ACTIVE', endsAt: { lte: now } },
    data: { status: 'EXPIRED' },
  })

  // Every trip to the checkout page writes a row before the student has paid
  // anything, so unfinished attempts accumulate forever. Marking them rather
  // than deleting keeps the funnel visible. A webhook that arrives late still
  // grants: grantForPayment keys off subscriptionId, not status.
  const checkouts = await prisma.payment.updateMany({
    where: { status: 'CREATED', createdAt: { lt: abandonedBefore } },
    data: { status: 'FAILED', failureReason: 'Checkout abandoned' },
  })

  const [resets, verifications] = await Promise.all([
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }], createdAt: { lt: purgeBefore } },
    }),
    prisma.emailVerificationToken.deleteMany({
      where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }], createdAt: { lt: purgeBefore } },
    }),
  ])

  return {
    subscriptionsExpired: subscriptions.count,
    checkoutsAbandoned: checkouts.count,
    tokensPurged: resets.count + verifications.count,
  }
}
