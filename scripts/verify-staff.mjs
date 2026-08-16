// Roles and the admin/teacher panel.
// Usage: VERIFY_BASE=http://localhost:3000 npm run verify:staff
import { chromium } from 'playwright'

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3000'
const fails = []
const check = (n, c, d = '') => {
  console.log(c ? `  . ${n}` : `  x ${n} ${d}`)
  if (!c) fails.push(n)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--no-proxy-server', '--disable-dev-shm-usage'],
})

async function as(email) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name=email]', email)
  await page.fill('input[name=password]', 'password123')
  await page.click('button[type=submit]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25000 })
  return { ctx, page }
}

// Matches the Forbidden component exactly. A looser pattern (e.g. /only.*admin/)
// matches across unrelated words once the body is flattened to one string.
const refused = async (page) =>
  (await page.textContent('body')).includes('does not have access to this area')

/**
 * Server action + revalidatePath + RSC refetch takes several seconds against a
 * dev server, so wait for the text rather than sleeping a fixed amount.
 */
const waitForText = (page, text, timeout = 30000) =>
  page
    .waitForFunction((t) => document.body.innerText.includes(t), text, { timeout })
    .then(() => true)
    .catch(() => false)

/** The mirror of the above — waits for something to go away after a delete. */
const waitForGone = (page, text, timeout = 30000) =>
  page
    .waitForFunction((t) => !document.body.innerText.includes(t), text, { timeout })
    .then(() => true)
    .catch(() => false)

console.log('\n[1] A student sees no staff area at all')
{
  const { ctx, page } = await as('student@paperpath.dev')
  check('no staff link in the sidebar', (await page.locator('a[href="/admin"]').count()) === 0)
  for (const path of ['/admin', '/admin/catalog', '/admin/people']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
    check(`${path} refuses a student`, await refused(page))
  }
  await ctx.close()
}

console.log('\n[2] A teacher gets the desk — content yes, catalog and roles no')
{
  const { ctx, page } = await as('teacher@paperpath.dev')
  check('staff link shown', (await page.locator('a[href="/admin"]').count()) > 0)

  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  const body = await page.textContent('body')
  check('sees the Teacher desk', body.includes('Teacher desk'))
  check('can add a course', body.includes('ADD A COURSE'))
  check('no Classes & subjects link', (await page.locator('a[href="/admin/catalog"]').count()) === 0)
  check('no People & roles link', (await page.locator('a[href="/admin/people"]').count()) === 0)

  for (const path of ['/admin/catalog', '/admin/people']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
    check(`${path} refuses a teacher`, await refused(page))
  }

  // Content editing must actually work for a teacher.
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  const courseHref = await page.getAttribute('a[href^="/admin/course/"]', 'href')
  await page.goto(`${BASE}${courseHref}`, { waitUntil: 'domcontentloaded' })
  check('teacher opens the course editor', !(await refused(page)))
  const chapterHref = await page.getAttribute('a[href^="/admin/chapter/"]', 'href')
  if (chapterHref) {
    await page.goto(`${BASE}${chapterHref}`, { waitUntil: 'domcontentloaded' })
    check('teacher opens the chapter/exam editor', !(await refused(page)))
  }
  await ctx.close()
}

console.log('\n[3] An admin can build a class, subject and course from scratch')
const stamp = Date.now().toString().slice(-6)
const className = `Probe Class ${stamp}`
const subjectName = `Probe Subject ${stamp}`
{
  const { ctx, page } = await as('admin@paperpath.dev')

  // Both forms use input[name=slug], and every existing row carries a collapsed
  // edit form, so an unscoped selector grabs a hidden field. Scope to the section.
  const classes = () => page.locator('section', { hasText: 'CLASSES' }).first()
  const subjects = () => page.locator('section', { hasText: 'SUBJECTS' }).first()

  await page.goto(`${BASE}/admin/catalog`, { waitUntil: 'domcontentloaded' })
  await classes().locator('button:has-text("New class")').click()
  await classes().locator('input[name=label]').first().fill(className)
  await classes().locator('input[name=slug]').first().fill(`probe-${stamp}`)
  await classes().locator('input[name=grade]').first().fill('9')
  await classes().locator('button:has-text("Create class")').click()
  check('class created', await waitForText(page, className))

  // Reload first: creating the class revalidates this route, which re-renders
  // the page underneath any form that is mid-edit.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await subjects().locator('button:has-text("New subject")').click()
  await subjects().locator('input[name=name]').first().fill(subjectName)
  await subjects().locator('input[name=slug]').first().fill(`probe-sub-${stamp}`)
  await subjects().locator('button:has-text("Create subject")').click()
  check('subject created', await waitForText(page, subjectName))

  // The new class and subject must reach the course form's dropdowns.
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  await page.click('button:has-text("New course")')
  await page.selectOption('select[name=classLevelId]', { label: className })
  await page.selectOption('select[name=subjectId]', { label: subjectName })
  await page.fill('input[name=price]', '999')
  await page.click('button:has-text("Create course")')
  check('course created', await waitForText(page, className))

  // And it must reach the public catalog, not just the admin list.
  // The class reaches the public catalog immediately. Its subjects do not show
  // yet, and should not: with no chapters written, /courses deliberately says
  // "still being written" rather than advertising an empty course.
  await page.goto(`${BASE}/courses`, { waitUntil: 'domcontentloaded' })
  const catalog = await page.textContent('body')
  check('new class shows on /courses', catalog.includes(className))
  check('empty class is labelled honestly, not sold', catalog.includes('still being written'))

  // Deleting a class that still has courses must be refused.
  await page.goto(`${BASE}/admin/catalog`, { waitUntil: 'domcontentloaded' })
  const row = page.locator('li', { hasText: className }).first()
  check('class delete blocked while courses exist', await row.locator('button:has-text("Delete")').isDisabled())
  await ctx.close()
}

console.log('\n[4] Cleaning up, which exercises delete in the right order')
{
  const { ctx, page } = await as('admin@paperpath.dev')
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  const section = page.locator('section', { hasText: className }).first()
  await section.locator('button:has-text("Delete")').first().click()
  check('course deleted', await waitForGone(page, subjectName))

  await page.goto(`${BASE}/admin/catalog`, { waitUntil: 'domcontentloaded' })
  await page.locator('li', { hasText: className }).first().locator('button:has-text("Delete")').click()
  await page.waitForTimeout(4000)
  await page.reload({ waitUntil: 'domcontentloaded' })
  check('class deleted once empty', !(await page.textContent('body')).includes(className))

  await page.locator('li', { hasText: subjectName }).first().locator('button:has-text("Delete")').click()
  await page.waitForTimeout(4000)
  await page.reload({ waitUntil: 'domcontentloaded' })
  check('subject deleted once unused', !(await page.textContent('body')).includes(subjectName))
  await ctx.close()
}

console.log('\n[5] Roles change, and the last admin cannot lock everyone out')
{
  const { ctx, page } = await as('admin@paperpath.dev')
  await page.goto(`${BASE}/admin/people`, { waitUntil: 'domcontentloaded' })
  check('own role is locked', await page.locator('li', { hasText: '(you)' }).first().locator('select').isDisabled())

  const row = () => page.locator('li', { hasText: 'student@paperpath.dev' }).first()
  await row().locator('select').selectOption('TEACHER')
  await row().locator('button:has-text("Set")').click()
  check('promotion saved', await waitForText(page, 'Saved'))

  await page.reload({ waitUntil: 'domcontentloaded' })
  check('student is now a TEACHER', (await row().locator('select').inputValue()) === 'TEACHER')

  await row().locator('select').selectOption('STUDENT')
  await row().locator('button:has-text("Set")').click()
  await page.waitForTimeout(3000)
  await page.reload({ waitUntil: 'domcontentloaded' })
  check('demoted back to STUDENT', (await row().locator('select').inputValue()) === 'STUDENT')
  await ctx.close()
}

await browser.close()
console.log(fails.length ? `\nFAILED (${fails.length}): ${fails.join(', ')}` : '\nALL STAFF CHECKS PASSED')
process.exit(fails.length ? 1 : 0)
