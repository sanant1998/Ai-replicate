import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhook } from '@/lib/razorpay'
import { grantForPayment, markPaymentFailed, revokeForPayment } from '@/lib/entitle'

export const runtime = 'nodejs'
// The signature is computed over the exact bytes Razorpay sent, so this route
// must never see a cached or re-encoded body.
export const dynamic = 'force-dynamic'

type RazorpayEvent = {
  event: string
  payload?: {
    payment?: {
      entity?: {
        id?: string
        order_id?: string
        amount?: number
        amount_refunded?: number
        error_description?: string
        notes?: Record<string, string>
      }
    }
    refund?: {
      entity?: {
        id?: string
        amount?: number
      }
    }
  }
}

export async function POST(req: Request) {
  const raw = await req.text()

  if (!verifyWebhook(raw, req.headers.get('x-razorpay-signature'))) {
    // 400, not 401: Razorpay retries on 5xx, and an unsigned body will never
    // start verifying no matter how many times it is resent.
    return NextResponse.json({ error: 'BAD_SIGNATURE' }, { status: 400 })
  }

  let event: RazorpayEvent
  try {
    event = JSON.parse(raw) as RazorpayEvent
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }

  const entity = event.payload?.payment?.entity
  const orderId = entity?.order_id
  if (!orderId) return NextResponse.json({ ok: true, ignored: event.event })

  // Look the payment up by the provider's order id rather than trusting the
  // notes: the order id is what we stored when we created the order.
  const payment = await prisma.payment.findUnique({ where: { providerOrderId: orderId } })
  if (!payment) {
    console.warn('[razorpay] webhook for unknown order', orderId)
    return NextResponse.json({ ok: true, ignored: 'unknown-order' })
  }

  switch (event.event) {
    case 'payment.captured':
    case 'order.paid': {
      // The order was created server-side from a database price, so the amount
      // should already match. Check it anyway: this is the last point before
      // access is handed over, and a mismatch means something upstream is not
      // what we think it is — grant nothing and let a human look.
      if (typeof entity?.amount === 'number' && entity.amount !== payment.amountPaise) {
        console.error(
          `[razorpay] amount mismatch on order ${orderId}: charged ${entity.amount}, expected ${payment.amountPaise}`,
        )
        return NextResponse.json({ error: 'AMOUNT_MISMATCH' }, { status: 400 })
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: { providerPaymentId: entity?.id ?? payment.providerPaymentId },
      })
      // Idempotent — a retried webhook returns 'already' and grants nothing new.
      const result = await grantForPayment(payment.id)
      return NextResponse.json({ ok: true, result })
    }

    case 'payment.failed': {
      await markPaymentFailed(payment.id, entity?.error_description ?? 'Payment failed')
      return NextResponse.json({ ok: true, result: 'failed' })
    }

    // Razorpay announces a refund on both of these, and which one arrives
    // depends on whether it was full or partial. Both route to the same
    // idempotent revoke, so receiving both is harmless.
    case 'refund.created':
    case 'refund.processed':
    case 'payment.refunded': {
      const refunded =
        event.payload?.refund?.entity?.amount ?? entity?.amount_refunded ?? payment.amountPaise

      // A partial refund is a billing adjustment, not a cancellation — someone
      // who got ₹100 back off a ₹999 bundle keeps the bundle. Only a full
      // refund takes the access away.
      if (refunded < payment.amountPaise) {
        console.warn(
          `[razorpay] partial refund on order ${orderId} (${refunded}/${payment.amountPaise}) — access left in place`,
        )
        return NextResponse.json({ ok: true, result: 'partial-refund' })
      }

      const result = await revokeForPayment(payment.id, refunded)
      return NextResponse.json({ ok: true, result })
    }

    default:
      return NextResponse.json({ ok: true, ignored: event.event })
  }
}
