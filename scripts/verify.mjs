import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('.verify-shots', { recursive: true })

const BASE = process.env.VERIFY_BASE ?? 'http://127.0.0.1:3000'
const shots = []
const fails = []

function check(name, cond, detail = '') {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    console.log(`  ✗ ${name} ${detail}`)
    fails.push(name)
  }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox','--no-proxy-server','--disable-dev-shm-usage'] })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
const page = await ctx.newPage()

const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(String(e)))

async function shot(name) {
  const p = `./.verify-shots/shot-${name}.png`
  // caret: 'initial' — the default 'hide' injects caret-color:transparent into
  // the live DOM, which React then reports as a hydration mismatch and the
  // console-error check counts as a failure. Screenshotting must not mutate the
  // page it is measuring.
  await page.screenshot({ path: p, fullPage: false, caret: 'initial' })
  shots.push(p)
}

console.log('\n[1] Catalog, signed out')
await page.goto(`${BASE}/academic`, { waitUntil: 'domcontentloaded' })
const body = await page.textContent('body')
check('renders Class - 8th', body.includes('Class - 8th'))
check('shows 44 chapters stat', body.includes('44'))
check('shows 166 topics stat', body.includes('166'))
check('bundle price ₹27,000 shown', body.includes('27,000'))
check('chapter 1 marked FREE', body.includes('FREE'))
check('later chapters Locked', body.includes('Locked'))
await shot('catalog-signed-out')

console.log('\n[2] Free chapter is playable while signed out')
await page.click('text=Rational Numbers')
await page.waitForURL('**/learn/**', { timeout: 15000 })
check('player page reached', page.url().includes('/learn/'))
check('video element present', (await page.locator('video').count()) === 1)
check('playlist shows 4 topics', (await page.locator('ol li').count()) === 4)
await shot('player-free')

console.log('\n[3] Locked chapter blocks access')
await page.goto(`${BASE}/academic`, { waitUntil: 'domcontentloaded' })
const locked = page.locator('article', { hasText: 'Linear Equations in One Variable' })
await locked.locator('a', { hasText: 'Locked' }).click()
// /checkout is readable while signed out on purpose — see the comment on the
// page itself: bouncing an anonymous visitor to /login meant asking them to
// create an account before they had been shown a single price. So the locked
// chapter leads to the plan, not to the lesson, and the *card* is what hands
// off to sign-in.
//
// This assertion used to wait for **/login** and had been wrong since that
// change was made. Nothing caught it because `npm run verify` never ran in CI.
await page.waitForURL('**/checkout**', { timeout: 15000 })
check('sent to the plan, not the player', !page.url().includes('/learn/'))
check('checkout is reachable while signed out', page.url().includes('/checkout?course='), page.url())

const buyCta = page.locator('a', { hasText: 'Sign in to buy' }).first()
check('price is shown before sign-up is asked for', (await page.textContent('body')).includes('₹'))
check('buying still needs an account', (await buyCta.count()) === 1)
check(
  'the sign-in link comes back to checkout',
  decodeURIComponent((await buyCta.getAttribute('href')) ?? '').includes('/checkout?course='),
  (await buyCta.getAttribute('href')) ?? '(no href)',
)

console.log('\n[4] Progress API rejects anonymous writes')
const anon = await page.evaluate(async (base) => {
  const r = await fetch(`${base}/api/progress`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ topicId: 'whatever', positionSec: 10 }),
  })
  return r.status
}, BASE)
check('POST /api/progress -> 401 when signed out', anon === 401, `got ${anon}`)

console.log('\n[5] Login as the premium demo account')
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[name=email]', 'premium@paperpath.dev')
await page.fill('input[name=password]', 'password123')
await shot('login')
await page.click('button[type=submit]')
await page.waitForURL('**/academic', { timeout: 15000 })
const afterLogin = await page.textContent('body')
check('session established, sidebar shows the student', afterLogin.includes('Diya Patel') || afterLogin.includes('Premium'))
check('premium sees no Locked chapters', !afterLogin.includes('Locked'))
check('daily credits rendered', afterLogin.includes('/50'))
await shot('catalog-premium')

console.log('\n[6] Premium can open a previously locked chapter')
await page.click('text=Linear Equations in One Variable')
await page.waitForURL('**/learn/**', { timeout: 15000 })
check('player opened for a paid chapter', page.url().includes('/learn/'))
check('no lock screen', !(await page.textContent('body')).includes('This chapter is locked'))

console.log('\n[7] Progress persists through the API')
const topicId = page.url().split('/learn/')[1]
const save = await page.evaluate(
  async ([base, id]) => {
    const r = await fetch(`${base}/api/progress`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topicId: id, positionSec: 321, completed: true }),
    })
    return { status: r.status, body: await r.json() }
  },
  [BASE, topicId],
)
check('POST /api/progress -> 200 when entitled', save.status === 200, `got ${save.status}`)
check('positionSec stored', save.body?.progress?.positionSec === 321)

await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('ol li')
check('completion reflected in the playlist', (await page.textContent('body')).includes('1 of'))
await shot('player-premium')

console.log('\n[8] Performance page reads real progress')
await page.goto(`${BASE}/performance`, { waitUntil: 'domcontentloaded' })
const perf = await page.textContent('body')
check('shows a completed topic', /Topics completed/.test(perf))
check('subject rollup present', perf.includes('Maths'))
await shot('performance')

console.log('\n[9] AI tutor surface')
await page.goto(`${BASE}/tutor`, { waitUntil: 'domcontentloaded' })
const tutor = await page.textContent('body')
check('chat UI renders', tutor.includes('AI Tutor'))
check('credits shown in header', /credits left today/.test(tutor))
check('suggestion chips offered', tutor.includes('Explain rational numbers'))
await shot('tutor')

console.log('\n[10] Tutor endpoint fails closed without an API key')
const tutorRes = await page.evaluate(async (base) => {
  const r = await fetch(`${base}/api/tutor`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}, BASE)
// The expected status depends on how the server is configured: with no key the
// route must fail closed, with one it must actually answer.
if (process.env.TUTOR_CONFIGURED === '1') {
  check('answers when an API key is configured', tutorRes.status === 200, `got ${tutorRes.status}`)
} else {
  check('returns 503 with a clear message, not a crash', tutorRes.status === 503, `got ${tutorRes.status}`)
}

console.log('\n[11] Checkout')
// Sign a brand-new account up so this check is idempotent across runs.
await ctx.clearCookies()
const fresh = `probe-${Date.now()}@paperpath.dev`
await page.goto(`${BASE}/login?mode=signup`, { waitUntil: 'domcontentloaded' })
await page.fill('input[name=name]', 'Probe Student')
await page.fill('input[name=email]', fresh)
await page.fill('input[name=password]', 'password123')
await page.selectOption('select[name=classLevelId]', { label: 'Class - 8th' })
await page.check('input[name=consent]')
await page.click('button[type=submit]')
await page.waitForURL('**/academic', { timeout: 15000 })
check('new free account sees Locked chapters', (await page.textContent('body')).includes('Locked'))

await page.goto(`${BASE}/checkout?class=class-8`, { waitUntil: 'domcontentloaded' })
await shot('checkout')
await page.click('button:has-text("Buy the bundle")')

if (process.env.PAYMENTS_MOCKED === '1') {
  // Dev only: ALLOW_MOCK_CHECKOUT grants without charging.
  await page.waitForURL('**/academic**', { timeout: 15000 })
  check('after purchase, nothing is Locked', !(await page.textContent('body')).includes('Locked'))
} else {
  // The important property in a production build: with no Razorpay keys the
  // mock path is compiled out, so checkout refuses instead of giving away access.
  // Scope to the form: Next.js's route announcer is also role="alert" and would
  // match first, empty.
  await page.waitForSelector('form [role=alert]', { timeout: 15000 })
  const msg = await page.textContent('form [role=alert]')
  check('refuses to sell when payments are not configured', /not configured/i.test(msg ?? ''), msg ?? '(empty)')
  await page.goto(`${BASE}/academic?class=class-8`, { waitUntil: 'domcontentloaded' })
  check('and grants nothing — chapters stay Locked', (await page.textContent('body')).includes('Locked'))
}

console.log('\n[12] Wrong password is rejected')
await ctx.clearCookies()
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[name=email]', 'student@paperpath.dev')
await page.fill('input[name=password]', 'wrongpassword')
await page.click('button[type=submit]')
await page.waitForSelector('[role=alert]', { timeout: 10000 })
check('shows an error and stays on /login', page.url().includes('/login'))

console.log('\n[13] Mobile layout')
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${BASE}/academic`, { waitUntil: 'domcontentloaded' })
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check('no horizontal overflow at 390px', overflow <= 1, `overflow ${overflow}px`)
await shot('mobile')

console.log('\n--- console errors ---')
const realErrors = consoleErrors.filter((e) => !/favicon|manifest|net::ERR/i.test(e) && !/status of (401|402|503)/.test(e)) // 401/503 are deliberately provoked by checks 4 and 10
check('no uncaught client errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

await browser.close()

console.log(`\nScreenshots: ${shots.join(' ')}`)
if (fails.length) {
  console.log(`\nFAILED (${fails.length}): ${fails.join(', ')}`)
  process.exit(1)
}
console.log('\nALL CHECKS PASSED')
