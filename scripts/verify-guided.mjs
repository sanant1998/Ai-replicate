// Proves the four things guided practice is actually being bought for:
//
//   1. The answer the client wrote is the answer the student reads, word for word.
//   2. The working arrives one step at a time and will not run ahead.
//   3. A question outside the topic is refused rather than answered.
//   4. The test account can reach this screen and nothing else.
//
// Run with a server up:
//   npm run dev            # terminal 1
//   npm run verify:guided
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('.verify-shots', { recursive: true })

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3000'
const EMAIL = process.env.VERIFY_TESTER_EMAIL ?? 'yashikaarora@test.com'
const PASSWORD = process.env.VERIFY_TESTER_PASSWORD ?? 'yashika@123'

// The topic to exercise, and one entry from its answer key. Pinned rather than
// "whatever is first in the list", because the exact-answer check needs a topic
// that actually has an answer key — and which topic sorts first changes every
// time somebody adds content. `npm run db:import-topic` prints the id.
// No default. The id that used to sit here outlived the content it named, and
// a stale id fails as a 404 on every case at once, which reads like the suite
// is broken rather than like it is pointed at nothing.
const TOPIC = process.env.VERIFY_TOPIC_ID
if (!TOPIC) {
  console.error('Set VERIFY_TOPIC_ID to the topic to exercise.')
  console.error('List them with: npm run db:remove-topic -- --list')
  process.exit(1)
}
const KEY_QUESTION =
  'A molecule Q is ionised by electron impact in a TOF mass spectrometer. The Q+ ion has a kinetic energy of 2.09 x 10^-15 J and takes 1.23 x 10^-5 s to reach the detector. The flight tube is 1.50 m long. Calculate the relative molecular mass of Q.'
// The stored string, byte for byte. Compared against what the API returns
// rather than against the rendered DOM: KaTeX emits the formula twice — once as
// MathML for screen readers, once as styled HTML — so the visible text is a
// typeset artefact, while the API response is the actual promise being kept.
const KEY_ANSWER = '$M_r = 169$ g mol$^{-1}$'

const fails = []
const check = (name, cond, detail = '') => {
  console.log(cond ? `  ✓ ${name}` : `  ✗ ${name} ${detail}`)
  if (!cond) fails.push(name)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--no-proxy-server'],
})
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
const page = await ctx.newPage()

console.log('\n[A] The test account signs in and lands on Guided Practice')
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[name=email]', EMAIL)
await page.fill('input[name=password]', PASSWORD)
await page.click('button[type=submit]')
await page.waitForURL('**/guided', { timeout: 20000 })
await page.waitForSelector('text=Pick a topic', { timeout: 20000 })
check('signed in and landed on /guided', true)

const nav = await page.evaluate(() => document.body.innerText)
check('sidebar offers Guided Practice', nav.includes('Guided Practice'))
check('sidebar hides the rest of the product', !nav.includes('Performance Analysis'))
check('no credit counter for an uncharged account', !/credits left today/i.test(nav))

console.log('\n[B] Every other page bounces back')
for (const path of ['/academic', '/tutor', '/pricing', '/profile']) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  check(`${path} redirects to /guided`, new URL(page.url()).pathname === '/guided', page.url())
}

console.log('\n[C] The general tutor refuses the test account')
const tutorStatus = await page.evaluate(async (base) => {
  const res = await fetch(`${base}/api/tutor`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'Who won the 1998 World Cup?' }),
  })
  return res.status
}, BASE)
check('/api/tutor returns 403', tutorStatus === 403, `got ${tutorStatus}`)

console.log('\n[D] The topic opens and takes a question')
await page.goto(`${BASE}/guided/${TOPIC}`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('textarea', { timeout: 20000 })
check('topic chat opened', /\/guided\/[a-z0-9]+/.test(page.url()), page.url())

// Typed rather than clicked from a suggestion: the suggestions only render on an
// empty transcript, and this account keeps its history between runs. The
// question is the answer key's own, so this is the exact-answer path.
const workingBlocks = () =>
  page.evaluate(
    () =>
      [...document.querySelectorAll('p')].filter((el) => el.textContent === 'HOW WE GET IT').length,
  )
const before = await workingBlocks()

await page.fill('textarea', KEY_QUESTION)
await page.click('button[aria-label=Ask]')
await page.waitForFunction(
  (n) =>
    [...document.querySelectorAll('p')].filter((el) => el.textContent === 'HOW WE GET IT').length >
    n,
  before,
  { timeout: 60000 },
)
check('an answer came back', (await workingBlocks()) === before + 1)

console.log('\n[E] The answer is the one on file, word for word')
// Checked against what the API returns, not against the rendered DOM: KaTeX
// emits every formula twice — once as MathML for screen readers, once as styled
// HTML — so the visible text is a typeset artefact, while the response body is
// the actual promise being kept.
const served = await page.evaluate(
  async ({ message, topicId }) => {
    const r = await fetch('/api/guided', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, topicId }),
    })
    return r.json()
  },
  { message: KEY_QUESTION, topicId: TOPIC },
)
check('the stored answer is served untouched', served.answer === KEY_ANSWER, `got: ${served.answer}`)
check('and an answer rendered on screen', (await page.locator('p:text-is("ANSWER")').count()) > 0)

console.log('\n[F] The working is gated')
const stepLine = () => page.locator('text=/^Step \\d+ of \\d+$/').last().textContent()
const shownSteps = () => page.locator('ol').last().locator('li').count()

const first = await stepLine()
check('opens on step 1', /^Step 1 of \d+$/.test(first), first)
const total = Number(first.match(/of (\d+)/)?.[1] ?? 0)
check('more than one step to walk through', total > 1, `${total} steps`)
check('only the first step is on screen', (await shownSteps()) === 1, `${await shownSteps()} shown`)

await page.locator('text=Got it — next step').last().click()
check('the button advances exactly one step', /^Step 2 of \d+$/.test(await stepLine()))
check('and reveals exactly one more', (await shownSteps()) === 2, `${await shownSteps()} shown`)

await page.screenshot({ path: './.verify-shots/shot-guided-gated.png', caret: 'initial' })

console.log('\n[G] "Whole answer" opens the rest')
await page.click('text=Whole answer')
check('every step shown', (await shownSteps()) === total, `${await shownSteps()} of ${total}`)
await page.screenshot({ path: './.verify-shots/shot-guided-whole.png', caret: 'initial' })

console.log('\n[H] Off-topic is refused, not answered')
await page.click('text=Step by step')
await page.fill('textarea', 'Who won the FIFA World Cup in 1998?')
await page.click('button[aria-label=Ask]')
await page.waitForFunction(() => document.body.innerText.includes("can't answer it here"), null, {
  timeout: 60000,
})
const refusal = await page.evaluate(() => document.body.innerText)
check('refusal shown', refusal.includes("can't answer it here"))
check('and it did not answer anyway', !/France|Brazil/i.test(refusal))
await page.screenshot({ path: './.verify-shots/shot-guided-offtopic.png', caret: 'initial' })

console.log('\n[I] The conversation survives a reload')
await page.reload({ waitUntil: 'domcontentloaded' })
// Wait for the transcript itself, not just the composer. The textarea renders
// before the messages do, so reading the page at that moment tests how fast the
// server is rather than whether anything was saved.
await page.waitForSelector('p:text-is("ANSWER")', { timeout: 25000 })
const after = await page.evaluate(() => document.body.innerText)
check('transcript persisted', after.includes("can't answer it here"))
check('the answer persisted too', after.includes('169'))

await browser.close()

console.log(
  fails.length === 0
    ? '\n✔ guided practice: all checks passed\n'
    : `\n✗ ${fails.length} failed: ${fails.join(', ')}\n`,
)
process.exit(fails.length === 0 ? 0 : 1)
