// Removes one guided-practice topic — its material, its answer key, and the
// practice sessions that hung off it.
//
//   npm run db:remove-topic <topicId>
//   npm run db:remove-topic --list
//
// The companion to `db:import-topic`, and the honest way to retire a body of
// content: re-importing over it leaves the old topic in the picker under its old
// name. Everything above the topic — subject, class, course, chapter — is left
// alone, because the next import will match it rather than build it again.
//
// Answers and progress cascade. Chat sessions do not: their topicId is set null
// so a student's own history survives the content being withdrawn.
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const id = process.argv[2]

if (!id || id === '--list') {
  const topics = await prisma.topic.findMany({
    where: { NOT: { content: null } },
    select: {
      id: true,
      title: true,
      _count: { select: { answers: true } },
      chapter: { select: { title: true, course: { select: { subject: { select: { name: true } } } } } },
    },
  })
  if (topics.length === 0) console.log('No guided-practice topics.')
  for (const t of topics) {
    console.log(
      `${t.id}  ${t.title}  (${t._count.answers} answers)\n` +
        `   ${t.chapter.course.subject.name} · ${t.chapter.title}`,
    )
  }
  if (!id) console.log('\nusage: npm run db:remove-topic <topicId>')
  await prisma.$disconnect()
  process.exit(0)
}

const topic = await prisma.topic.findUnique({
  where: { id },
  select: {
    title: true,
    chapter: { select: { id: true, title: true } },
    _count: { select: { answers: true, progress: true, notes: true, chatSessions: true } },
  },
})

if (!topic) {
  console.error(`No topic with id ${id}. Run with --list to see what there is.`)
  await prisma.$disconnect()
  process.exit(1)
}

const c = topic._count
console.log(`Removing "${topic.title}" from ${topic.chapter.title}`)
console.log(`  ${c.answers} answers, ${c.progress} progress rows, ${c.notes} notes — deleted`)
console.log(`  ${c.chatSessions} chat sessions — kept, unlinked`)

await prisma.topic.delete({ where: { id } })

const left = await prisma.chapter.findUnique({
  where: { id: topic.chapter.id },
  select: { _count: { select: { topics: true } } },
})
console.log(`Done. "${topic.chapter.title}" now holds ${left?._count.topics ?? 0} topic(s).`)

await prisma.$disconnect()
