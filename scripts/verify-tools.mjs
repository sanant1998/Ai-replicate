// Drives every tool in /tools through a real browser.
// Usage: VERIFY_BASE=http://localhost:3000 npm run verify:tools
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('.verify-shots', { recursive: true })

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3000'
const fails = []

function check(name, condition, detail = '') {
  if (condition) console.log(`  . ${name}`)
  else {
    console.log(`  x ${name} ${detail}`)
    fails.push(name)
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--no-proxy-server', '--disable-dev-shm-usage'],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()

const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(String(e)))

const shot = (name) =>
  page.screenshot({ path: `./.verify-shots/tool-${name}.png`, fullPage: false, caret: 'initial' })

console.log('\n[0] Sign in and open Tools')
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[name=email]', 'premium@paperpath.dev')
await page.fill('input[name=password]', 'password123')
await page.click('button[type=submit]')
await page.waitForURL('**/academic', { timeout: 20000 })

await page.goto(`${BASE}/tools`, { waitUntil: 'domcontentloaded' })
const names = [
  'Science Text Editor',
  'Graphing Calculator',
  'Scientific Calculator',
  'Ketcher Editor',
  'Periodic Table',
  'Matrix Calculator',
]
const body = await page.textContent('body')
for (const n of names) check(`card listed: ${n}`, body.includes(n))
await shot('gallery')

const open = async (name) => {
  await page.goto(`${BASE}/tools`, { waitUntil: 'domcontentloaded' })
  await page.click(`button:has-text("${name}")`)
  // Each tool opens a full-screen ToolShell dialog. Generous timeout: against a
  // dev server each panel is compiled on first open.
  await page.waitForSelector(`div[role=dialog][aria-label="${name}"]`, { timeout: 90000 })
}

/** Switch a shell sidebar tab by its label. */
const tab = async (label) => {
  await page.click(`[role=tab]:has-text("${label}")`)
  await page.waitForTimeout(150)
}

console.log('\n[1] Scientific Calculator computes')
await open('Scientific Calculator')
await page.fill('#calc-expression', '2+3*4')
await page.click('[role=dialog] button:has-text("=")')
check('2+3*4 = 14', (await page.inputValue('#calc-expression')) === '14')
await page.fill('#calc-expression', '')
await page.fill('#calc-expression', 'sin(90)')
await page.click('[role=dialog] button:has-text("=")')
check('sin(90) = 1 in degree mode', (await page.inputValue('#calc-expression')) === '1')
// Degrees is the default; switching must change the answer.
await page.click('[role=dialog] button[aria-pressed="false"]:has-text("rad")')
await page.fill('#calc-expression', 'sin(90)')
await page.click('[role=dialog] button:has-text("=")')
const radAnswer = Number(await page.inputValue('#calc-expression'))
check('sin(90) in radians is not 1', Math.abs(radAnswer - 1) > 0.1, `got ${radAnswer}`)
check('history recorded the entries', (await page.textContent('[role=dialog] aside')).includes('2+3*4'))
// The shell's theme toggle must flip the dialog, not the whole page.
await page.click('button[aria-label="Switch to dark theme"]')
check(
  'dark theme applies to the shell only',
  (await page.getAttribute('[role=dialog]', 'data-theme')) === 'dark' &&
    !(await page.getAttribute('html', 'class'))?.includes('dark'),
)
await page.click('button[aria-label="Switch to light theme"]')
await shot('scientific')

console.log('\n[2] Graphing Calculator draws')
await open('Graphing Calculator')
check('canvas present', (await page.locator('[role=dialog] canvas').count()) === 1)
const painted = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  const ctx = c.getContext('2d')
  const { data } = ctx.getImageData(0, 0, c.width, c.height)
  // Any pixel that is neither white nor a faint grid line means a curve drew.
  let coloured = 0
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    if (Math.abs(r - g) > 25 || Math.abs(g - b) > 25) coloured++
  }
  return coloured
})
check('a curve was actually rendered', painted > 200, `${painted} coloured pixels`)
await page.fill('input[aria-label="Function of x"]', 'nonsense(')
await page.waitForTimeout(300)
check(
  'bad input shows an error',
  (await page.textContent('body')).includes('Unknown function'),
  await page.textContent('body').then((t) => (t.includes('Unknown') ? '' : '(no message)')),
)
// Zoom and Reset must actually move the viewport, not just look clickable.
await page.fill('input[aria-label="Function of x"]', 'sin(x)')
await page.waitForTimeout(200)
const readout = () => page.textContent('[role=dialog] >> text=/x \\[/')
const beforeZoom = await readout()
await page.click('[role=dialog] button[aria-label="Zoom in"]')
await page.waitForTimeout(250)
const afterZoom = await readout()
check('Zoom in changes the viewport', beforeZoom !== afterZoom, `${beforeZoom} -> ${afterZoom}`)
await page.click('[role=dialog] button:has-text("Reset")')
await page.waitForTimeout(250)
check('Reset restores the default viewport', (await readout()) === beforeZoom)

// Grid toggle must repaint the canvas.
const pixels = () =>
  page.evaluate(() => {
    const c = document.querySelector('[role=dialog] canvas')
    const d = c.getContext('2d').getImageData(0, 0, c.width, Math.min(200, c.height)).data
    let n = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) n++
    return n
  })
const withGrid = await pixels()
await page.click('[role=dialog] button:has-text("Grid")')
await page.waitForTimeout(300)
const withoutGrid = await pixels()
check('Grid toggle repaints the canvas', withGrid !== withoutGrid, `${withGrid} vs ${withoutGrid}`)
await page.click('[role=dialog] button:has-text("Grid")')

// Download must actually produce a PNG blob.
const png = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const c = document.querySelector('[role=dialog] canvas')
      c.toBlob((b) => resolve(b ? b.size : 0), 'image/png')
    }),
)
check('Download produces a PNG', png > 1000, `${png} bytes`)
await shot('graphing')

console.log('\n[3] Matrix Calculator')
await open('Matrix Calculator')
const resultRegion = 'div[role=region][aria-label="Result"]'

// A defaults to the 3×3 identity and B to 1..9, so A × B must return B unchanged.
await page.click('[role=dialog] button:has-text("Multiply")')
await page.waitForSelector(resultRegion, { timeout: 10000 })
const product = await page.textContent(resultRegion)
check(
  'identity × B returns B',
  ['1', '5', '9'].every((n) => product.includes(n)) && !product.includes('could not be'),
  product.replace(/\s+/g, ' ').slice(0, 80),
)

// det(I) is exactly 1.
await page.click('[role=dialog] button:has-text("Determinant")')
await page.waitForTimeout(250)
check('determinant of the identity is 1', (await page.textContent(resultRegion)).includes('1'))

// Force a shape error: a 3×4 B cannot be added to a 3×3 A.
await page.fill('input[aria-label="Columns in matrix B"]', '4')
await page.click('[role=dialog] button:has-text("Add")')
await page.waitForSelector('[role=dialog] [role=alert]', { timeout: 10000 })
check('mismatched addition is refused', (await page.textContent('[role=dialog] [role=alert]')).includes('same size'))
await shot('matrix')

console.log('\n[4] Periodic Table')
await open('Periodic Table')
check('all 118 elements rendered', (await page.locator('button[aria-label*="atomic number"]').count()) === 118)
await page.click('button[aria-label="Carbon, atomic number 6"]')
await page.waitForTimeout(200)
const carbon = await page.textContent('[role=dialog]')
check('carbon details shown', carbon.includes('12.011') && carbon.includes('[He] 2s2 2p2'))
await page.fill('input[aria-label="Search elements"]', 'gold')
await page.waitForTimeout(200)
check('search finds gold', (await page.textContent('body')).includes('1 match'))
await shot('periodic')

console.log('\n[5] Science Text Editor')
await open('Science Text Editor')
await page.waitForSelector('#science-source', { timeout: 20000 })
// The sample contains $ maths; KaTeX must turn it into markup, not leave it raw.
await page.waitForSelector('[role=dialog] .katex', { timeout: 10000 })
check('LaTeX rendered by KaTeX', (await page.locator('[role=dialog] .katex').count()) > 0)
await page.fill('#science-source', 'Water is $H_2O$ and **bold** works.')
await page.waitForTimeout(300)
check('bold rendered as markup', (await page.locator('[role=dialog] strong:has-text("bold")').count()) === 1)
check('raw dollar signs are gone from the preview', !(await page.textContent('[role=dialog] .md-body')).includes('$H_2O$'))
await shot('editor')

console.log('\n[6] Ketcher Editor')
await open('Ketcher Editor')
await tab('Export')
// Ketcher also mounts a *hidden* macromolecules editor alongside the visible
// molecules one, and it comes first in the DOM — so neither "any svg in the
// frame" nor its zoom label is a usable readiness signal; both resolve to
// something invisible. The enabled button below is the real signal.
// state:'attached' — the default waits for *visibility*, and the first svg in
// the DOM belongs to that hidden panel, so it would never satisfy it.
await page.waitForSelector('.ketcher-frame svg', { state: 'attached', timeout: 120000 })
check('Ketcher mounted its editor', (await page.locator('.ketcher-frame svg').count()) > 20)

// Round-trip through Ketcher's own API. This is the real proof that the
// WebAssembly chemistry engine booted — the DOM alone only proves React ran.
// The button enables itself from Ketcher's onInit, so it doubles as the
// engine-ready signal; no sleep needed.
await page.waitForSelector('[role=dialog] button:has-text("Get SMILES"):not([disabled])', { timeout: 120000 })
await page.click('[role=dialog] button:has-text("Get SMILES")')
// <output>, not <code> — the Export tab's own help text contains a `CCO`
// example in a <code>, which would otherwise match first.
await page.waitForSelector('[role=dialog] output', { timeout: 30000 })
check(
  'SMILES round-trip reaches the chemistry engine',
  (await page.textContent('[role=dialog] output')).includes('canvas is empty'),
  await page.textContent('[role=dialog] output'),
)
await shot('ketcher')

console.log('\n--- console errors ---')
const real = consoleErrors.filter((e) => !/favicon|manifest|net::ERR|Download the React/i.test(e))
check('no uncaught client errors', real.length === 0, real.slice(0, 3).join(' | '))

await browser.close()

if (fails.length) {
  console.log(`\nFAILED (${fails.length}): ${fails.join(', ')}`)
  process.exit(1)
}
console.log('\nALL TOOL CHECKS PASSED')
