import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyWebhook } from '@/lib/razorpay'
import { grantForPayment, markPaymentFailed } from '@/lib/entitle'

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
        error_description?: string
        notes?: Record<string, string>
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

    default:
      return NextResponse.json({ ok: true, ignored: event.event })
  }
}
