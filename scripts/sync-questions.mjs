// Puts prisma/questions.ts into an existing database without touching anything
// else.
//
// `db:seed` is the other way to get questions in, and it starts by deleting
// every table — accounts, purchases, progress, tutor history. That is correct
// for a fresh database and catastrophic for one with users on it, which is
// exactly the state a catalog sits in once the quiz bank grows. So: upsert the
// questions, leave the rest of the database alone.
//
//   npm run db:questions            # apply
//   npm run db:questions -- --dry   # say what would change, write nothing
//
// Run through tsx rather than node, because the Prisma client is generated as
// TypeScript.
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.ts'
import { QUESTIONS } from '../prisma/questions.ts'

const dryRun = process.argv.includes('--dry')

/**
 * The bank is keyed "<subject slug>:<chapter index>", and the seed attaches it
 * to Class 8 — the only class with real chapter and topic data. Kept as one
 * constant rather than inferred, so this script cannot quietly write Class 8
 * questions onto a Class 9 chapter that happens to share an index.
 */
const CLASS_SLUG = process.env.QUESTIONS_CLASS_SLUG ?? 'class-8'

const classLevel = await prisma.classLevel.findFirst({
  where: { slug: CLASS_SLUG },
  include: { courses: { include: { subject: true, chapters: { orderBy: { index: 'asc' } } } } },
})

if (!classLevel) {
  console.error(`No class with slug "${CLASS_SLUG}". Run \`npm run db:seed\` on an empty database first.`)
  process.exit(1)
}

const chapterFor = (subjectSlug, index) =>
  classLevel.courses
    .find((c) => c.subject.slug === subjectSlug)
    ?.chapters.find((ch) => ch.index === index) ?? null

let created = 0
let updated = 0
let unchanged = 0
const missing = []
const extra = []

for (const [key, bank] of Object.entries(QUESTIONS)) {
  const [subjectSlug, rawIndex] = key.split(':')
  const chapter = chapterFor(subjectSlug, Number(rawIndex))
  if (!chapter) {
    missing.push(key)
    continue
  }

  const existing = await prisma.question.findMany({
    where: { chapterId: chapter.id },
    orderBy: { index: 'asc' },
  })
  const byIndex = new Map(existing.map((q) => [q.index, q]))

  for (const [i, seed] of bank.entries()) {
    const index = i + 1
    const data = {
      kind: seed.kind,
      prompt: seed.prompt,
      options: seed.kind === 'MCQ' ? (seed.options ?? []) : [],
      answer: seed.answer,
      explanation: seed.explanation ?? null,
      difficulty: seed.difficulty ?? 1,
      marks: seed.marks ?? 1,
    }

    const current = byIndex.get(index)
    if (!current) {
      if (!dryRun) await prisma.question.create({ data: { chapterId: chapter.id, index, ...data } })
      created += 1
      continue
    }

    const same =
      current.kind === data.kind &&
      current.prompt === data.prompt &&
      current.answer === data.answer &&
      current.explanation === data.explanation &&
      current.difficulty === data.difficulty &&
      current.marks === data.marks &&
      current.options.length === data.options.length &&
      current.options.every((o, n) => o === data.options[n])

    if (same) {
      unchanged += 1
      continue
    }

    if (!dryRun) await prisma.question.update({ where: { id: current.id }, data })
    updated += 1
  }

  // Anything past the end of the bank is reported, never deleted: deleting a
  // Question cascades to every QuizAnswer given for it, which would rewrite
  // students' marked attempts to make a content file tidy.
  for (const q of existing) {
    if (q.index > bank.length) extra.push(`${key} #${q.index}: ${q.prompt.slice(0, 60)}`)
  }
}

const total = await prisma.question.count()

console.log(dryRun ? '\nDry run — nothing was written.\n' : '')
console.log(`  created   ${created}`)
console.log(`  updated   ${updated}`)
console.log(`  unchanged ${unchanged}`)
console.log(
  dryRun
    ? `  questions in the database: ${total} now, ${total + created} after applying`
    : `  questions in the database: ${total}`,
)

if (missing.length) {
  console.log(`\n  ! no chapter in ${CLASS_SLUG} for: ${missing.join(', ')}`)
  console.log('    The bank has questions for chapters this catalog does not carry.')
}

if (extra.length) {
  console.log(`\n  ! ${extra.length} question(s) exist beyond the end of the bank and were left alone:`)
  for (const line of extra) console.log(`      ${line}`)
  console.log('    Delete them in /admin if they are stale — doing it here would take')
  console.log('    students’ answers to them with it.')
}

await prisma.$disconnect()
