'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'
import { isConfigured, createRefund } from '@/lib/razorpay'
import { revokeForPayment } from '@/lib/entitle'
import type { AdminState } from './actions'

/**
 * Refund decisions are ADMIN-only, not staff.
 *
 * Everything else in the panel is teaching content, where the worst mistake is
 * a wrong chapter title. This moves money, and a teacher who can author a quiz
 * has no reason to be able to send someone ₹27,000.
 */
function guard() {
  return async function run(fn: () => Promise<AdminState>): Promise<AdminState> {
    try {
      await requireAdmin()
      return await fn()
    } catch (err) {
      if (err instanceof Error && err.message === 'FORBIDDEN') {
        return { error: 'Only an admin can decide a refund.' }
      }
      console.error('[admin/payments]', err)
      return { error: err instanceof Error ? err.message : 'That did not work. Please try again.' }
    }
  }
}

const asAdmin = guard()

/**
 * Approves a refund and sends it to the provider.
 *
 * The request row is claimed first — `updateMany` filtered on the status we
 * expect — and only then is Razorpay called. Razorpay's refund endpoint has no
 * idempotency key, so a double-clicked approval really would pay out twice; the
 * claim is what makes the second click find nothing to do.
 *
 * Access is *not* taken away here. The refund webhook calls `revokeForPayment`,
 * as it does for a refund issued from Razorpay's own dashboard, so there stays
 * exactly one path that cancels a subscription.
 */
export async function approveRefund(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return asAdmin(async () => {
    const me = await requireAdmin()
    const id = String(formData.get('id') ?? '')
    const note = String(formData.get('note') ?? '').trim().slice(0, 1000)

    const request = await prisma.refundRequest.findUnique({
      where: { id },
      include: { payment: true },
    })
    if (!request) return { error: 'That request no longer exists.' }
    if (request.status !== 'REQUESTED') return { error: 'That request has already been decided.' }
    if (request.payment.refundedAt) return { error: 'That payment has already been refunded.' }

    const { count } = await prisma.refundRequest.updateMany({
      where: { id, status: 'REQUESTED' },
      data: {
        status: 'SENT',
        decidedById: me.id,
        decidedAt: new Date(),
        decisionNote: note || null,
      },
    })
    if (count === 0) return { error: 'Someone else just decided that request.' }

    // A payment taken through the mock checkout has no provider behind it, so
    // there is nothing to call and no webhook coming. Revoke directly, and say
    // so on the record rather than pretending money moved.
    const providerPaymentId = request.payment.providerPaymentId
    if (!isConfigured() || request.payment.provider === 'mock' || !providerPaymentId) {
      await revokeForPayment(request.payment.id)
      await prisma.refundRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          decisionNote: [note, 'Access revoked without a provider refund (no live payment).']
            .filter(Boolean)
            .join(' — ')
            .slice(0, 1000),
        },
      })
      revalidatePath('/admin/payments')
      return { saved: true }
    }

    try {
      await createRefund({
        providerPaymentId,
        amountPaise: request.payment.amountPaise,
        notes: { refundRequestId: request.id, paymentId: request.payment.id },
      })
    } catch (err) {
      // Put it back so it can be tried again; leaving it SENT would strand the
      // student in a state nobody can act on.
      await prisma.refundRequest.update({
        where: { id },
        data: { status: 'REQUESTED', decidedById: null, decidedAt: null },
      })
      throw err
    }

    await prisma.refundRequest.update({ where: { id }, data: { status: 'APPROVED' } })
    revalidatePath('/admin/payments')
    return { saved: true }
  })
}

export async function declineRefund(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return asAdmin(async () => {
    const me = await requireAdmin()
    const id = String(formData.get('id') ?? '')
    const note = String(formData.get('note') ?? '').trim().slice(0, 1000)
    if (note.length < 5) return { error: 'Give a reason — the student is shown it.' }

    const { count } = await prisma.refundRequest.updateMany({
      where: { id, status: 'REQUESTED' },
      data: { status: 'DECLINED', decidedById: me.id, decidedAt: new Date(), decisionNote: note },
    })
    if (count === 0) return { error: 'That request has already been decided.' }

    revalidatePath('/admin/payments')
    return { saved: true }
  })
}
