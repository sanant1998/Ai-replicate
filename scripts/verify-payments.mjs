// Exercises the payment path that must never be reachable without a signature,
// and proves the webhook grants exactly once however many times it arrives.
//
// Run with a server up:
//   npm start                                            # terminal 1
//   RAZORPAY_WEBHOOK_SECRET=test_webhook_secret npm run verify:payments
//
// Run through tsx rather than plain node, because the idempotency legs need the
// Prisma client — and that is generated as TypeScript.
import 'dotenv/config'
import { createHmac, randomUUID } from 'node:crypto'
import { prisma } from '../src/lib/prisma.ts'

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3000'
const SECRET = 'test_webhook_secret'

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) {
    pass += 1
    console.log(`  ok    ${name}`)
  } else {
    fail += 1
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const hook = (body, signature) =>
  fetch(`${BASE}/api/payments/razorpay/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(signature ? { 'x-razorpay-signature': signature } : {}),
    },
    body,
  })

const sign = (body) => createHmac('sha256', SECRET).update(body).digest('hex')

const captured = (orderId, amount) =>
  JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: `pay_${orderId}`, order_id: orderId, amount } } },
  })

const orderPaid = (orderId, amount) =>
  JSON.stringify({
    event: 'order.paid',
    payload: { payment: { entity: { id: `pay_${orderId}`, order_id: orderId, amount } } },
  })

// A server that is not running used to surface as an unhandled TypeError, which
// reads like a broken test rather than a missing prerequisite — and that is
// exactly how this suite failed in CI for every run.
async function requireServer() {
  try {
    const res = await fetch(`${BASE}/api/health`)
    if (!res.ok) throw new Error(`health returned ${res.status}`)
  } catch (err) {
    console.error(
      `\nNo app answering on ${BASE} (${err instanceof Error ? err.message : err}).\n` +
        'Start one first: npm run build && npm start, or set VERIFY_BASE.\n',
    )
    process.exit(1)
  }
}

await requireServer()

console.log('\nRazorpay webhook — signature')

const event = captured('order_does_not_exist')

const noSig = await hook(event, null)
check('unsigned webhook is rejected', noSig.status === 400, `got ${noSig.status}`)

const badSig = await hook(event, 'deadbeef')
check('wrong signature is rejected', badSig.status === 400, `got ${badSig.status}`)

if (process.env.RAZORPAY_WEBHOOK_SECRET !== SECRET) {
  console.log(
    `\n  Signature and idempotency legs skipped: set RAZORPAY_WEBHOOK_SECRET="${SECRET}" ` +
      'for both this script and the server, then restart the server.',
  )
} else {
  const signed = await hook(event, sign(event))
  const body = await signed.json()
  check('correctly signed webhook is accepted', signed.status === 200, `got ${signed.status}`)
  check('unknown order is ignored, not granted', body.ignored === 'unknown-order', JSON.stringify(body))

  // A tampered body must fail even though the signature itself is well-formed.
  const tampered = event.replace('pay_order_does_not_exist', 'pay_evil')
  const replay = await hook(tampered, sign(event))
  check('body tampering invalidates the signature', replay.status === 400, `got ${replay.status}`)

  await idempotency()
}

/**
 * The half the suite always claimed to cover and never did.
 *
 * Razorpay retries a webhook it could not confirm, and announces one capture on
 * both `payment.captured` and `order.paid` when both are subscribed. Each of
 * those is a separate HTTP request, so they can land at once — and a grant that
 * checks "already granted?" outside its transaction will run twice, leaving a
 * second Subscription that no Payment row points at. That extra row still
 * grants access, and a refund would never take it back.
 */
async function idempotency() {
  console.log('\nRazorpay webhook — grants exactly once')

  const classLevel = await prisma.classLevel.findFirst({
    where: { bundlePricePaise: { not: null } },
  })
  if (!classLevel) {
    console.log('  ! no class with a bundle price — run `npm run db:seed` first')
    fail += 1
    return
  }

  const email = `webhook-idempotency-${randomUUID()}@paperpath.test`
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Webhook Suite',
      // Never a usable login: bcrypt cannot verify a string that is not a hash.
      passwordHash: 'not-a-real-hash',
    },
  })

  const newPayment = async () => {
    const orderId = `order_ci_${randomUUID().replaceAll('-', '')}`
    await prisma.payment.create({
      data: {
        userId: user.id,
        scope: 'CLASS',
        classLevelId: classLevel.id,
        amountPaise: classLevel.bundlePricePaise,
        providerOrderId: orderId,
      },
    })
    return orderId
  }

  const subsFor = (orderId) =>
    prisma.subscription.count({
      where: { userId: user.id, classLevelId: classLevel.id, payment: { providerOrderId: orderId } },
    })

  const allSubs = () => prisma.subscription.count({ where: { userId: user.id } })

  try {
    // --- retried delivery, one after the other ------------------------------
    const sequential = await newPayment()
    const body = captured(sequential, classLevel.bundlePricePaise)
    const first = await hook(body, sign(body)).then((r) => r.json())
    const second = await hook(body, sign(body)).then((r) => r.json())

    check('first delivery grants', first.result === 'granted', JSON.stringify(first))
    check('retried delivery grants nothing new', second.result === 'already', JSON.stringify(second))
    check('exactly one subscription after a retry', (await subsFor(sequential)) === 1)

    // --- payment.captured and order.paid arriving together -------------------
    const before = await allSubs()
    const concurrent = await newPayment()
    const a = captured(concurrent, classLevel.bundlePricePaise)
    const b = orderPaid(concurrent, classLevel.bundlePricePaise)
    await Promise.all([hook(a, sign(a)), hook(b, sign(b))])

    const linked = await subsFor(concurrent)
    check('exactly one subscription from two simultaneous events', linked === 1, `got ${linked}`)
    // The count that catches an orphan: a second Subscription no Payment points
    // at is invisible to the query above but still grants access.
    const total = await allSubs()
    check('no orphan subscription left behind', total === before + 1, `expected ${before + 1}, got ${total}`)

    // --- a refund takes the access back --------------------------------------
    const refund = JSON.stringify({
      event: 'payment.refunded',
      payload: {
        payment: {
          entity: {
            id: `pay_${sequential}`,
            order_id: sequential,
            amount_refunded: classLevel.bundlePricePaise,
          },
        },
      },
    })
    await hook(refund, sign(refund))
    const active = await prisma.subscription.count({ where: { userId: user.id, status: 'ACTIVE' } })
    check('a full refund cancels what it bought', active === 1, `${active} still ACTIVE`)
  } finally {
    // Cascades through payments, subscriptions and the credit ledger.
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`)
await prisma.$disconnect()
process.exit(fail ? 1 : 0)
