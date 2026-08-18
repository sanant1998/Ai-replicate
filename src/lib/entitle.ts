import 'server-only'
import { prisma } from '@/lib/prisma'
import { BUNDLE_CREDIT_CAP, FREE_CREDIT_CAP } from '@/lib/credits'
import type { Prisma } from '@/generated/prisma/client'

/** The columns the grant and revoke paths read once they hold the row lock. */
type LockedPayment = {
  id: string
  userId: string
  scope: 'COURSE' | 'CLASS'
  courseId: string | null
  classLevelId: string | null
  amountPaise: number
  subscriptionId: string | null
  refundedAt: Date | null
}

/**
 * Takes the payment row for the rest of the transaction.
 *
 * `SELECT … FOR UPDATE` rather than a plain read, because the decision that
 * follows — "has this already been granted?" — is only safe if no one else can
 * answer it at the same time. Razorpay retries a delivery it could not confirm,
 * and announces one capture on both `payment.captured` and `order.paid` when
 * both are subscribed; those are separate HTTP requests and can land together.
 *
 * Reading `subscriptionId` outside a lock let both see null and both grant. The
 * second Subscription is not reachable from any Payment, so nothing points at
 * it to clean up — but `getEntitlements` reads the Subscription table directly,
 * so it still unlocks the course, and `revokeForPayment` would never cancel it.
 * A refunded student kept their access.
 */
async function lockPayment(
  tx: Prisma.TransactionClient,
  paymentId: string,
): Promise<LockedPayment | null> {
  const rows = await tx.$queryRaw<LockedPayment[]>`
    SELECT "id", "userId", "scope", "courseId", "classLevelId",
           "amountPaise", "subscriptionId", "refundedAt"
    FROM "Payment"
    WHERE "id" = ${paymentId}
    FOR UPDATE
  `
  return rows[0] ?? null
}

/**
 * The single place a Subscription is ever created.
 *
 * Idempotent under concurrency, not just in sequence: the payment row is locked
 * before its state is read, so a second delivery waits for the first to commit
 * and then sees the subscription it created.
 */
export async function grantForPayment(paymentId: string): Promise<'granted' | 'already' | 'missing'> {
  return prisma.$transaction(async (tx) => {
    const payment = await lockPayment(tx, paymentId)
    if (!payment) return 'missing'
    if (payment.subscriptionId) return 'already'

    const endsAt = new Date()
    endsAt.setFullYear(endsAt.getFullYear() + 1)

    const subscription = await tx.subscription.create({
      data: {
        userId: payment.userId,
        scope: payment.scope,
        courseId: payment.scope === 'COURSE' ? payment.courseId : null,
        classLevelId: payment.scope === 'CLASS' ? payment.classLevelId : null,
        pricePaise: payment.amountPaise,
        endsAt,
      },
    })

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID', subscriptionId: subscription.id },
    })

    // Bundle buyers get a bigger daily allowance for the AI tutor.
    if (payment.scope === 'CLASS') {
      await tx.user.update({
        where: { id: payment.userId },
        data: { dailyCreditCap: BUNDLE_CREDIT_CAP, dailyCredits: BUNDLE_CREDIT_CAP },
      })
    }

    return 'granted'
  })
}

export async function markPaymentFailed(paymentId: string, reason: string) {
  await prisma.payment.updateMany({
    where: { id: paymentId, status: 'CREATED' },
    data: { status: 'FAILED', failureReason: reason.slice(0, 400) },
  })
}

/**
 * Takes back what a payment bought, when the provider says the money went back.
 *
 * The mirror image of grantForPayment, and the half that was missing: without
 * it a student could buy a year, refund inside the seven days the terms
 * promise, and keep the year. Cancelling the subscription is enough to close
 * that — getEntitlements only counts ACTIVE rows, and every gate re-reads them
 * per request, so access stops on the next click rather than at renewal.
 *
 * Idempotent under the same lock as the grant: a provider that sends
 * refund.created twice, or sends it alongside payment.refunded, must not
 * double-apply.
 */
export async function revokeForPayment(
  paymentId: string,
  refundedPaise?: number,
): Promise<'revoked' | 'already' | 'missing'> {
  return prisma.$transaction(async (tx) => {
    const payment = await lockPayment(tx, paymentId)
    if (!payment) return 'missing'
    if (payment.refundedAt) return 'already'

    if (payment.subscriptionId) {
      await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 'CANCELLED', endsAt: new Date() },
      })
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        refundedPaise: refundedPaise ?? payment.amountPaise,
      },
    })

    // The bundle raised this account's tutor allowance; the refund lowers it
    // again — but only if this was the last bundle they hold. Dropping the cap
    // unconditionally punished a student who had bought two classes and
    // refunded one: the remaining bundle was still active and still paid for,
    // and they were put back on the free allowance anyway.
    if (payment.scope === 'CLASS') {
      const stillBundled = await tx.subscription.count({
        where: {
          userId: payment.userId,
          scope: 'CLASS',
          status: 'ACTIVE',
          endsAt: { gt: new Date() },
        },
      })
      if (stillBundled === 0) {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: payment.userId },
          select: { dailyCredits: true },
        })
        // Clamp today's balance rather than assigning it, so a student who has
        // already spent down to 1 is not handed 5 back on the way out.
        await tx.user.update({
          where: { id: payment.userId },
          data: {
            dailyCreditCap: FREE_CREDIT_CAP,
            dailyCredits: Math.min(user.dailyCredits, FREE_CREDIT_CAP),
          },
        })
      }
    }

    return 'revoked'
  })
}
