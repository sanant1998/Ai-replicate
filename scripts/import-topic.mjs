// Imports one guided-practice topic — its material and its answer key — from a
// JSON file.
//
//   npm run db:import-topic prisma/topics/aqa-a-level-chemistry.json
//
// The file is the source of truth for what it names, so a re-import replaces
// the material and the answer key rather than merging into them. That is the
// opposite of `db:tester`, and deliberately so: this is how a body of content
// gets revised, and a merge would leave deleted questions behind for ever.
// Everything above the topic — subject, class, course, chapter — is matched or
// created, never overwritten.
//
// Run through tsx: the Prisma client is generated as TypeScript.
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { SUBJECT_META } from '../prisma/syllabus.ts'

const file = process.argv[2]
if (!file) {
  console.error('usage: npm run db:import-topic <file.json>')
  process.exit(1)
}

const spec = JSON.parse(readFileSync(file, 'utf8'))
for (const key of ['subjectSlug', 'classSlug', 'chapter', 'topic', 'content']) {
  if (!spec[key]) {
    console.error(`${file}: missing "${key}"`)
    process.exit(1)
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
  }),
})

const board = await prisma.board.findFirst({ where: { code: spec.boardCode ?? 'CBSE' } })
if (!board) throw new Error('No such board — run `npm run db:seed` first.')

const classLevel = await prisma.classLevel.findFirst({
  where: { boardId: board.id, slug: spec.classSlug },
})
if (!classLevel) throw new Error(`No class level "${spec.classSlug}" on board ${board.code}.`)

const meta = SUBJECT_META[spec.subjectSlug]
const subject =
  (await prisma.subject.findFirst({ where: { slug: spec.subjectSlug } })) ??
  (await prisma.subject.create({
    data: { slug: spec.subjectSlug, ...(meta ?? { name: spec.subjectSlug }) },
  }))

const course =
  (await prisma.course.findFirst({
    where: { classLevelId: classLevel.id, subjectId: subject.id },
  })) ??
  (await prisma.course.create({
    data: { classLevelId: classLevel.id, subjectId: subject.id, pricePaise: 0 },
  }))

const existingChapter = await prisma.chapter.findFirst({
  where: { courseId: course.id, index: spec.chapter.index },
})
// Refuse to land on top of somebody else's chapter. Chapter numbers in this
// catalog come from the syllabus, so an import that picked a number already in
// use would silently rename a real chapter into an imported one — which is
// exactly what happened the first time this ran. Matching titles means it is
// this file's own chapter and re-importing is the intent.
if (existingChapter && existingChapter.title !== spec.chapter.title) {
  console.error(
    `Chapter ${spec.chapter.index} of this course is already "${existingChapter.title}".\n` +
      `Pick an unused chapter index in ${file} — imported content conventionally uses 90+.`,
  )
  process.exit(1)
}
const chapter = existingChapter
  ? await prisma.chapter.update({
      where: { id: existingChapter.id },
      data: {
        title: spec.chapter.title,
        isFree: spec.chapter.isFree ?? true,
        summary: spec.chapter.summary ?? null,
      },
    })
  : await prisma.chapter.create({
      data: {
        courseId: course.id,
        index: spec.chapter.index,
        title: spec.chapter.title,
        isFree: spec.chapter.isFree ?? true,
        summary: spec.chapter.summary ?? null,
      },
    })

const existingTopic = await prisma.topic.findFirst({
  where: { chapterId: chapter.id, index: spec.topic.index },
})
// Same rule one level down, for the same reason.
if (existingTopic && existingTopic.title !== spec.topic.title) {
  console.error(
    `Topic ${spec.topic.index} of that chapter is already "${existingTopic.title}".\n` +
      `Pick an unused topic index in ${file}.`,
  )
  process.exit(1)
}
const topic = existingTopic
  ? await prisma.topic.update({
      where: { id: existingTopic.id },
      data: { title: spec.topic.title, kind: spec.topic.kind ?? 'ACTIVITY', content: spec.content },
    })
  : await prisma.topic.create({
      data: {
        chapterId: chapter.id,
        index: spec.topic.index,
        title: spec.topic.title,
        kind: spec.topic.kind ?? 'ACTIVITY',
        content: spec.content,
      },
    })

// Replace wholesale. Deleting first also means the (topicId, index) uniqueness
// cannot trip on a file that has renumbered its questions.
await prisma.topicAnswer.deleteMany({ where: { topicId: topic.id } })
for (const entry of spec.answers ?? []) {
  await prisma.topicAnswer.create({
    data: {
      topicId: topic.id,
      index: entry.index,
      question: entry.question,
      answer: entry.answer,
      steps: entry.steps ?? [],
    },
  })
}

console.log('✔ imported')
console.log(`  ${subject.name} · ${classLevel.label} · Ch ${chapter.index}: ${chapter.title}`)
console.log(`  topic    ${topic.title}`)
console.log(`  material ${spec.content.length} characters`)
console.log(`  answers  ${(spec.answers ?? []).length}`)
console.log(`  admin    /admin/topic/${topic.id}`)

await prisma.$disconnect()
