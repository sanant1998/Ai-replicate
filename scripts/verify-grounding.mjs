// Grounding has two failure modes and only one of them is obvious.
//
// The obvious one is answering something the material does not cover. The one
// that actually shows up in use is the opposite: a student pastes a hint from
// their own notes, it does not read as a question, and the tutor decides it is
// off topic — telling them their own syllabus is out of bounds. This suite
// pushes on both sides, because a prompt tightened against one drifts into the
// other.
//
// Run with a server up:
//   npm run dev
//   npm run verify:grounding
import { chromium } from 'playwright'

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3000'
const EMAIL = process.env.VERIFY_TESTER_EMAIL ?? 'yashikaarora@test.com'
const PASSWORD = process.env.VERIFY_TESTER_PASSWORD ?? 'yashika@123'
// The AQA topic, unless told otherwise — `npm run db:import-topic` prints its id.
const TOPIC = process.env.VERIFY_TOPIC_ID ?? 'cmsyasvpo0001z8w2plfxu8kd'

// `on` means the material covers it and a refusal is a bug. `off` means it does
// not and an answer is a bug.
const CASES = [
  // --- things a student actually types --------------------------------------
  {
    on: true,
    message:
      'You just need to write the correct overall redox equation and apply basic maths at the end of question to find concentration of hydrogen peroxide in the end.',
    why: 'a hint from the student’s own notes, phrased as a statement',
  },
  { on: true, message: 'explain the redox equation for hydrogen peroxide', why: 'the equation is in the material' },
  { on: true, message: 'why do we multiply by 20 at the end?', why: 'a follow-up about one step' },
  { on: true, message: 'Kw', why: 'a bare term the material uses' },
  { on: true, message: 'I do not understand the buffer one', why: 'vague, but plainly about a question on file' },
  { on: true, message: 'pH nikalo buffer me KOH daalne ke baad', why: 'the same question in another language' },
  { on: true, message: 'is the answer to the TOF question 169?', why: 'checking an answer that is on file' },

  // --- things it must still refuse ------------------------------------------
  { on: false, message: 'Who won the FIFA World Cup in 1998?', why: 'nothing to do with study' },
  { on: false, message: 'Explain photosynthesis in plants.', why: 'a different subject' },
  { on: false, message: 'What is the derivative of sin(x)?', why: 'a different subject' },
  { on: false, message: 'Describe the mechanism of nucleophilic substitution in haloalkanes.', why: 'chemistry, but not this material' },
  { on: false, message: 'Write me a poem about titrations.', why: 'on subject, but not a thing the material can answer' },
]

// /api/guided allows ten questions a minute per account, and this suite sends
// more than that. Pace it rather than raising the limit — the limit is doing
// its job, and a suite that needs it lifted is testing a different app.
const PACE_MS = 6500

const fails = []

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--no-proxy-server'],
})
const page = await (await browser.newContext()).newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[name=email]', EMAIL)
await page.fill('input[name=password]', PASSWORD)
await page.click('button[type=submit]')
await page.waitForSelector('text=Pick a topic', { timeout: 25000 })

console.log('\nShould be answered')
for (const c of CASES.filter((c) => c.on)) await run(c)

console.log('\nShould be refused')
for (const c of CASES.filter((c) => !c.on)) await run(c)

async function run(c) {
  if (run.started) await new Promise((r) => setTimeout(r, PACE_MS))
  run.started = true

  const res = await page.evaluate(
    async ({ message, topicId }) => {
      const r = await fetch('/api/guided', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, topicId }),
      })
      return { status: r.status, body: await r.json() }
    },
    { message: c.message, topicId: TOPIC },
  )

  if (res.status !== 200) {
    console.log(`  ✗ HTTP ${res.status} — ${res.body?.message ?? res.body?.error}`)
    fails.push(c.message)
    return
  }

  const ok = res.body.onTopic === c.on
  const label = c.message.length > 64 ? `${c.message.slice(0, 61)}…` : c.message
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
  if (!ok) {
    console.log(`      expected ${c.on ? 'an answer' : 'a refusal'} — ${c.why}`)
    console.log(`      got: ${String(res.body.answer).slice(0, 120)}`)
    fails.push(c.message)
  }
}

await browser.close()

console.log(
  fails.length === 0
    ? `\n✔ grounding: ${CASES.length}/${CASES.length} classified correctly\n`
    : `\n✗ ${fails.length} of ${CASES.length} misclassified\n`,
)
process.exit(fails.length === 0 ? 0 : 1)
