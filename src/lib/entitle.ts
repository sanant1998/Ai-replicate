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
