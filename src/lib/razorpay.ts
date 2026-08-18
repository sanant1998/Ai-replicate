import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Razorpay, kept to the two calls that matter: create an order, and verify that
 * a webhook really came from Razorpay. Nothing here grants access — that only
 * happens in the webhook handler, after the signature checks out.
 */
const API = 'https://api.razorpay.com/v1'

export function isConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

export function publicKeyId() {
  return process.env.RAZORPAY_KEY_ID ?? null
}

function authHeader() {
  const id = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!id || !secret) throw new Error('Razorpay keys are not configured')
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`
}

export type RazorpayOrder = { id: string; amount: number; currency: string; status: string }

export async function createOrder(opts: {
  amountPaise: number
  receipt: string
  notes: Record<string, string>
}): Promise<RazorpayOrder> {
  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { authorization: authHeader(), 'content-type': 'application/json' },
    body: JSON.stringify({
      amount: opts.amountPaise,
      currency: 'INR',
      receipt: opts.receipt,
      notes: opts.notes,
      payment_capture: 1,
    }),
  })

  if (!res.ok) {
    throw new Error(`Razorpay rejected the order (${res.status}): ${await res.text()}`)
  }
  return (await res.json()) as RazorpayOrder
}

/**
 * Sends the money back.
 *
 * Deliberately does not touch entitlement: the refund webhook is still the only
 * thing that calls `revokeForPayment`, so there is exactly one path that takes
 * access away, whether the refund started here or in Razorpay's dashboard.
 *
 * `speed: 'normal'` rather than 'optimum' — optimum tries an instant refund and
 * charges for it. A student promised a refund "within 7 working days" does not
 * need it in ten minutes at a premium.
 *
 * There is no idempotency header on this endpoint, so calling it twice really
 * does issue two refunds. The caller is responsible for not doing that: the
 * approval moves its RefundRequest to SENT inside the same transaction that
 * reads it, so a double-clicked approval finds the row already claimed.
 */
export async function createRefund(opts: {
  providerPaymentId: string
  amountPaise: number
  notes: Record<string, string>
}): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API}/payments/${encodeURIComponent(opts.providerPaymentId)}/refund`, {
    method: 'POST',
    headers: { authorization: authHeader(), 'content-type': 'application/json' },
    body: JSON.stringify({
      amount: opts.amountPaise,
      speed: 'normal',
      notes: opts.notes,
    }),
  })

  if (!res.ok) {
    throw new Error(`Razorpay refused the refund (${res.status}): ${await res.text()}`)
  }
  return (await res.json()) as { id: string; status: string }
}

function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Verifies a webhook against the *raw* request body. Re-serialising parsed JSON
 * changes the bytes and breaks the HMAC, so callers must pass `await req.text()`.
 */
export function verifyWebhook(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeEqualHex(signature, expected)
}

/**
 * Verifies the handler payload the browser hands back after a successful
 * payment. Useful to show the student a confirmed screen immediately — but it
 * is a convenience only; entitlement still waits for the webhook.
 */
export function verifyPaymentHandoff(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
  return safeEqualHex(signature, expected)
}
