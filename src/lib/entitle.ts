import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * The single place a Subscription is ever created.
 *
 * Idempotent by construction: the Payment row owns the subscription via a
 * unique `subscriptionId`, and this bails out if one is already attached. A
 * webhook Razorpay retries three times therefore grants exactly once.
 */
export async function grantForPayment(paymentId: string): Promise<'granted' | 'already' | 'missing'> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment) return 'missing'
  if (payment.subscriptionId) return 'already'

  const endsAt = new Date()
  endsAt.setFullYear(endsAt.getFullYear() + 1)

  await prisma.$transaction(async (tx) => {
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
        data: { dailyCreditCap: 50, dailyCredits: 50 },
      })
    }
  })

  return 'granted'
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
 * Idempotent, like the grant: a provider that sends refund.created twice, or
 * sends it alongside payment.refunded, must not double-apply.
 */
export async function revokeForPayment(
  paymentId: string,
  refundedPaise?: number,
): Promise<'revoked' | 'already' | 'missing'> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment) return 'missing'
  if (payment.refundedAt) return 'already'

  await prisma.$transaction(async (tx) => {
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
    // again. Clamp today's balance rather than assigning it, so a student who
    // has already spent down to 1 is not handed 5 back on the way out.
    if (payment.scope === 'CLASS') {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: payment.userId },
        select: { dailyCredits: true },
      })
      await tx.user.update({
        where: { id: payment.userId },
        data: { dailyCreditCap: 5, dailyCredits: Math.min(user.dailyCredits, 5) },
      })
    }
  })

  return 'revoked'
}
