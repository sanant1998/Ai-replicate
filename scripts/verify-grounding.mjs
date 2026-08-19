// Guided practice answers in two layers, and this suite checks the boundary
// between them and the boundary around them both.
//
// Layer one is the uploaded material: it answers, and its numbers and notation
// are what the student reads. Layer two is the model's own knowledge of the
// topic, for the things the notes assume rather than state — a definition, the
// rule behind a step, another question of the same kind. A student needs those
// to follow the material at all, so refusing them is a bug.
//
// Outside both is a different subject, an unrelated chapter, or something that
// is not study, and answering those is also a bug. A prompt tightened against
// one of these mistakes drifts into the other, which is why both are here.
//
// Run with a server up:
//   npm run dev
//   npm run verify:grounding
import { chromium } from 'playwright'

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3000'
const EMAIL = process.env.VERIFY_TESTER_EMAIL ?? 'yashikaarora@test.com'
const PASSWORD = process.env.VERIFY_TESTER_PASSWORD ?? 'yashika@123'

// No default. The id that used to sit here outlived the content it named, and
// a stale id fails as a 404 on every case at once, which reads like the suite
// is broken rather than like it is pointed at nothing.
const TOPIC = process.env.VERIFY_TOPIC_ID
if (!TOPIC) {
  console.error(
    'Set VERIFY_TOPIC_ID to the topic to exercise.
' +
      'List them with: npm run db:remove-topic -- --list',
  )
  process.exit(1)
}

// `on` means the topic covers it and a refusal is a bug; `off` means it does not
// and an answer is a bug. `from` pins which layer should have answered — set it
// only where the case exists to test that boundary, since a question can often
// be answered honestly from either side.
const CASES = [
  // --- things a student actually types --------------------------------------
  {
    on: true,
    message:
      'You just need to write the correct overall redox equation and apply basic maths at the end of question to find concentration of hydrogen peroxide in the end.',
    why: 'a hint from the student’s own notes, phrased as a statement',
  },
  { on: true, from: 'material', message: 'explain the redox equation for hydrogen peroxide', why: 'the equation is in the material' },
  { on: true, message: 'why do we multiply by 20 at the end?', why: 'a follow-up about one step' },
  { on: true, message: 'Kw', why: 'a bare term the material uses' },
  { on: true, message: 'I do not understand the buffer one', why: 'vague, but plainly about a question on file' },
  { on: true, message: 'pH nikalo buffer me KOH daalne ke baad', why: 'the same question in another language' },
  { on: true, from: 'material', message: 'is the answer to the TOF question 169?', why: 'checking an answer that is on file' },

  // --- the topic, past the edge of the uploaded pages ------------------------
  // These are the ones strict grounding used to refuse. Every one of them is
  // something a student working through this material would need in order to
  // get through it, and none of them is written out in the notes.
  // No `from`: the material works the buffer through step by step without ever
  // naming the relationship, so calling the answer either layer is honest.
  { on: true, message: 'What is the Henderson-Hasselbalch equation?', why: 'the buffer solution uses it without naming it' },
  { on: true, from: 'general', message: 'Why is kinetic energy half mv squared?', why: 'the theory behind a step the material takes' },
  // No `from` either: a question modelled on the material draws on the material
  // to build it, so the label is a judgement call rather than a fact.
  { on: true, message: 'Give me another buffer question like this one to practise on', why: 'another question of the same kind' },
  { on: true, from: 'general', message: 'what does mol dm-3 actually mean', why: 'a unit the material uses and never defines' },
  { on: true, from: 'general', message: 'what is a mole', why: 'assumed knowledge, and the whole topic rests on it' },

  // --- things it must still refuse ------------------------------------------
  { on: false, message: 'Who won the FIFA World Cup in 1998?', why: 'nothing to do with study' },
  { on: false, message: 'Explain photosynthesis in plants.', why: 'a different subject' },
  { on: false, message: 'Write me a poem about titrations.', why: 'names the subject, but is not a question about it' },
  { on: false, message: 'Summarise the causes of the First World War.', why: 'a different subject entirely' },
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

  const classified = res.body.onTopic === c.on
  // Only checked where the case names it. Somewhere in the middle — a term the
  // notes mention in passing and the model also knows cold — either layer is an
  // honest answer, and asserting one would be testing the model's mood.
  const sourced = !c.from || !c.on || res.body.source === c.from
  const ok = classified && sourced

  const label = c.message.length > 64 ? `${c.message.slice(0, 61)}…` : c.message
  console.log(`  ${ok ? '✓' : '✗'} ${label}${c.from ? ` [${c.from}]` : ''}`)
  if (!ok) {
    if (!classified) console.log(`      expected ${c.on ? 'an answer' : 'a refusal'} — ${c.why}`)
    else console.log(`      expected source "${c.from}", got "${res.body.source}" — ${c.why}`)
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
