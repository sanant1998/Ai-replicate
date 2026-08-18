'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/session'
import { hit } from '@/lib/rate-limit'
import { REFUND_WINDOW_DAYS, withinRefundWindow } from '@/lib/billing'

export type RefundState = { error?: string; saved?: string }

/**
 * A student claiming the refund /terms promises them.
 *
 * This only records the ask. Nothing about their access changes here, and no
 * money moves: a staff member decides, and the refund webhook is still the only
 * thing that revokes. Splitting it that way keeps one path into
 * `revokeForPayment` no matter where the refund was started.
 */
export async function requestRefund(_prev: RefundState, formData: FormData): Promise<RefundState> {
  const user = await currentUser()
  if (!user) redirect('/login?next=%2Fprofile')

  const burst = await hit(`refund:${user.id}`, 5, 24 * 60 * 60_000)
  if (!burst.ok) {
    return { error: 'You have already sent us several requests. Please wait for a reply.' }
  }

  const paymentId = String(formData.get('paymentId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  if (reason.length < 5) return { error: 'Tell us briefly why, so we can help' }
  if (reason.length > 1000) return { error: 'Please keep it shorter than 1000 characters' }

  // Scoped to the signed-in account, so a forged id matches nothing.
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId: user.id },
    include: { refundRequests: true },
  })
  if (!payment) return { error: 'We cannot find that payment.' }
  if (payment.status !== 'PAID') return { error: 'That payment did not complete, so there is nothing to refund.' }
  if (payment.refundedAt) return { error: 'That payment has already been refunded.' }

  if (payment.refundRequests.some((r) => r.status === 'REQUESTED' || r.status === 'SENT')) {
    return { error: 'We already have a request for this payment and are looking at it.' }
  }

  // The window is checked here as well as shown in the UI: the button being
  // hidden is a courtesy, not a rule.
  if (!withinRefundWindow(payment.createdAt)) {
    return {
      error: `The ${REFUND_WINDOW_DAYS}-day refund window for this payment has closed. Write to us anyway if something has gone wrong.`,
    }
  }

  await prisma.refundRequest.create({
    data: { paymentId: payment.id, userId: user.id, reason },
  })

  revalidatePath('/profile')
  return { saved: 'Request sent. We will reply by email within a few working days.' }
}
