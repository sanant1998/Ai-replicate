import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('.verify-shots', { recursive: true })

const BASE = 'http://127.0.0.1:3001'
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

console.log('\n[A] Sign in')
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[name=email]', 'student@paperpath.dev')
await page.fill('input[name=password]', 'password123')
await page.click('button[type=submit]')
await page.waitForURL('**/academic', { timeout: 15000 })
check('signed in as the free student', true)

console.log('\n[B] Streamed answer renders token by token')
await page.goto(`${BASE}/tutor`, { waitUntil: 'domcontentloaded' })
const before = Number((await page.textContent('body')).match(/(\d+) credits left today/)?.[1])

await page.fill('textarea', 'What is a rational number?')
await page.click('button[aria-label=Send]')
await page.waitForFunction(
  () => document.body.innerText.includes('What is 1/2 + 1/3?'),
  { timeout: 20000 },
)
const body = await page.textContent('body')
check('assistant reply streamed into the transcript', body.includes('Think of a rational number'))
check('user turn shown', body.includes('What is a rational number?'))

const after = Number(body.match(/(\d+) credits left today/)?.[1])
check('one credit consumed', after === before - 1, `${before} -> ${after}`)
// caret: 'initial' — see the note in verify.mjs; the default mutates the DOM.
await page.screenshot({ path: './.verify-shots/shot-tutor-live.png', caret: 'initial' })

console.log('\n[C] Transcript survives a reload')
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Think of a rational number', { timeout: 15000 })
check('messages persisted to the database', true)

console.log('\n[D] History page lists the session')
await page.goto(`${BASE}/history`, { waitUntil: 'domcontentloaded' })
const hist = await page.textContent('body')
check('session appears in History', hist.includes('What is a rational number?'))
check('message count rendered', /\d+ messages/.test(hist))

console.log('\n[E] Credits run out and the route fails closed with 402')
const drain = await page.evaluate(async (base) => {
  const codes = []
  for (let i = 0; i < 8; i++) {
    const r = await fetch(`${base}/api/tutor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `drain ${i}` }),
    })
    codes.push(r.status)
    if (r.body) await r.text()
  }
  return codes
}, BASE)
check('eventually returns 402 OUT_OF_CREDITS', drain.includes(402), drain.join(','))
check('never returns a 5xx', !drain.some((c) => c >= 500), drain.join(','))

console.log('\n[F] Locked chapter context is refused')
// Discover a locked chapter rather than relying on an env var: an unset
// LOCKED_CHAPTER_ID silently sent chapterId: undefined, which the route
// correctly treats as a general question — so the check proved nothing.
//
// The catalog deliberately hides the AI Tutor link on chapters you cannot open,
// so the id has to come from an account that *can* see it. Borrow it from the
// premium account, then probe it back as the free student.
const grabChapterId = async () => {
  await page.goto(`${BASE}/academic?class=class-8&subject=maths`, { waitUntil: 'domcontentloaded' })
  return page.evaluate(() => {
    const article = [...document.querySelectorAll('article')].find(
      (a) => !a.textContent.includes('FREE') && a.querySelector('a[href*="/tutor?chapter="]'),
    )
    return article?.querySelector('a[href*="/tutor?chapter="]')?.getAttribute('href')?.split('=')[1] ?? null
  })
}

const signIn = async (email) => {
  await ctx.clearCookies()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name=email]', email)
  await page.fill('input[name=password]', 'password123')
  await page.click('button[type=submit]')
  await page.waitForURL('**/academic', { timeout: 15000 })
}

await signIn('premium@paperpath.dev')
const lockedChapterId = await grabChapterId()
await signIn('student@paperpath.dev')

if (!lockedChapterId) {
  check('found a locked chapter to probe', false, 'no locked chapter rendered')
} else {
  const locked = await page.evaluate(async ([base, id]) => {
    const r = await fetch(`${base}/api/tutor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'hi', chapterId: id }),
    })
    return r.status
  }, [BASE, lockedChapterId])
  // 403 must win over 402: entitlement is checked before a credit is spent, so
  // a student out of credits still cannot probe paid content.
  check('403 for a chapter the student has not paid for', locked === 403, `got ${locked}`)
}

await browser.close()
if (fails.length) {
  console.log(`\nFAILED (${fails.length}): ${fails.join(', ')}`)
  process.exit(1)
}
console.log('\nTUTOR CHECKS PASSED')
