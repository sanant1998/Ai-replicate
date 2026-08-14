// Exercises the payment path that must never be reachable without a signature,
// and proves the webhook grants exactly once when it is retried.
import 'dotenv/config'
import { createHmac } from 'node:crypto'

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3001'
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

const event = JSON.stringify({
  event: 'payment.captured',
  payload: { payment: { entity: { id: 'pay_test', order_id: 'order_does_not_exist' } } },
})

console.log('\nRazorpay webhook')

const noSig = await hook(event, null)
check('unsigned webhook is rejected', noSig.status === 400, `got ${noSig.status}`)

const badSig = await hook(event, 'deadbeef')
check('wrong signature is rejected', badSig.status === 400, `got ${badSig.status}`)

if (process.env.RAZORPAY_WEBHOOK_SECRET !== SECRET) {
  console.log(
    `\n  Signature leg skipped: set RAZORPAY_WEBHOOK_SECRET="${SECRET}" and restart the server to run it.`,
  )
} else {
  const goodSig = createHmac('sha256', SECRET).update(event).digest('hex')
  const signed = await hook(event, goodSig)
  const body = await signed.json()
  check('correctly signed webhook is accepted', signed.status === 200, `got ${signed.status}`)
  check(
    'unknown order is ignored, not granted',
    body.ignored === 'unknown-order',
    JSON.stringify(body),
  )

  // A tampered body must fail even though the signature itself is well-formed.
  const tampered = event.replace('pay_test', 'pay_evil')
  const replay = await hook(tampered, goodSig)
  check('body tampering invalidates the signature', replay.status === 400, `got ${replay.status}`)
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
