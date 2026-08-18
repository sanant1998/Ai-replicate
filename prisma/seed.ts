import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { QUESTIONS } from './questions.js'
import { SUBJECT_META, SYLLABUS } from './syllabus.js'
import { seedTester, TESTER_EMAIL } from './tester.js'

// Seeding writes a lot of rows in sequence, so it uses the direct endpoint when
// one is configured — same reason migrations do.
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL!,
  }),
})

/** Duration helper: "1h44m" | "47m" -> seconds */
function dur(s: string): number {
  const h = /(\d+)h/.exec(s)?.[1]
  const m = /(\d+)m/.exec(s)?.[1]
  return (Number(h ?? 0) * 60 + Number(m ?? 0)) * 60
}

/** A public HLS test stream so the player works out of the box. Swap for your CDN. */
const DEMO_HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

type ChapterSeed = { title: string; topics: number; duration: string }

// Class 8 CBSE — catalog mirrored from the live product's chapter listing.
const CLASS8_MATHS: ChapterSeed[] = [
  { title: 'Rational Numbers', topics: 4, duration: '1h44m' },
  { title: 'Linear Equations in One Variable', topics: 4, duration: '2h20m' },
  { title: 'Understanding Quadrilaterals', topics: 4, duration: '2h9m' },
  { title: 'Practical Geometry', topics: 2, duration: '33m' },
  { title: 'Data Handling', topics: 4, duration: '2h14m' },
  { title: 'Squares and Square Roots', topics: 3, duration: '2h12m' },
  { title: 'Cubes and Cube Roots', topics: 3, duration: '25m' },
  { title: 'Comparing Quantities', topics: 5, duration: '2h19m' },
  { title: 'Algebraic Expressions and Identities', topics: 4, duration: '1h3m' },
  { title: 'Visualising Solid Shapes', topics: 3, duration: '28m' },
  { title: 'Mensuration', topics: 4, duration: '3h58m' },
  { title: 'Exponents and Powers', topics: 3, duration: '36m' },
  { title: 'Direct and Inverse Proportions', topics: 2, duration: '34m' },
  { title: 'Factorisation', topics: 4, duration: '52m' },
  { title: 'Introduction to Graphs', topics: 3, duration: '1h10m' },
  { title: 'Playing with Numbers', topics: 3, duration: '48m' },
]

const CLASS8_SCIENCE: ChapterSeed[] = [
  { title: 'Crop Production and Management', topics: 4, duration: '1h40m' },
  { title: 'Microorganisms: Friend and Foe', topics: 4, duration: '1h35m' },
  { title: 'Synthetic Fibres and Plastics', topics: 4, duration: '47m' },
  { title: 'Materials: Metals and Non-Metals', topics: 4, duration: '1h22m' },
  { title: 'Coal and Petroleum', topics: 3, duration: '54m' },
  { title: 'Combustion and Flame', topics: 4, duration: '34m' },
  { title: 'Conservation of Plants and Animals', topics: 4, duration: '1h46m' },
  { title: 'Cell — Structure and Functions', topics: 4, duration: '1h59m' },
  { title: 'Reproduction in Animals', topics: 4, duration: '1h54m' },
  { title: 'Reaching the Age of Adolescence', topics: 4, duration: '1h51m' },
  { title: 'Force and Pressure', topics: 4, duration: '48m' },
  { title: 'Friction', topics: 3, duration: '35m' },
  { title: 'Sound', topics: 4, duration: '1h27m' },
  { title: 'Chemical Effects of Electric Current', topics: 4, duration: '2h7m' },
  { title: 'Some Natural Phenomena', topics: 4, duration: '59m' },
  { title: 'Light', topics: 4, duration: '1h39m' },
  { title: 'Stars and the Solar System', topics: 4, duration: '3h50m' },
  { title: 'Pollution of Air and Water', topics: 4, duration: '4h10m' },
]

const CLASS8_AI: ChapterSeed[] = [
  { title: 'Class 7 Recap & Builder Mindset', topics: 3, duration: '45m' },
  { title: 'Python Power-Up', topics: 5, duration: '1h20m' },
  { title: 'Prompting Mastery', topics: 4, duration: '1h5m' },
  { title: 'Multi-Modal AI Workflows', topics: 4, duration: '1h10m' },
  { title: 'Talking to AI with Code', topics: 4, duration: '1h15m' },
  { title: 'AI Content Studio', topics: 4, duration: '1h' },
  { title: 'Using AI Agents', topics: 3, duration: '50m' },
  { title: 'AI Research Partner & Code', topics: 5, duration: '1h25m' },
  { title: 'AI Ethics — Bias, Deepfakes & IP', topics: 4, duration: '55m' },
  { title: 'Capstone Project', topics: 5, duration: '1h30m' },
]

const CLASS_LEVELS = [
  { slug: 'class-5', label: 'Class - 5th', grade: 5 },
  { slug: 'class-6', label: 'Class - 6th', grade: 6 },
  { slug: 'class-7', label: 'Class - 7th', grade: 7 },
  { slug: 'class-8', label: 'Class - 8th', grade: 8 },
  { slug: 'class-9', label: 'Class - 9th', grade: 9 },
  { slug: 'class-10', label: 'Class - 10th', grade: 10 },
  { slug: 'class-11', label: 'Class - 11th', grade: 11 },
  { slug: 'class-12', label: 'Class - 12th', grade: 12 },
  { slug: 'class-11-commerce', label: 'Class - 11th Commerce', grade: 11, stream: 'COMMERCE' as const },
  { slug: 'class-12-commerce', label: 'Class - 12th Commerce', grade: 12, stream: 'COMMERCE' as const },
]

const SUBJECT_PRICE_PAISE = 12_000_00 // ₹12,000 per subject per year

async function main() {
  console.log('→ resetting data')
  await prisma.creditLedger.deleteMany()
  await prisma.chatMessage.deleteMany()
  await prisma.chatSession.deleteMany()
  await prisma.progress.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.user.deleteMany()
  await prisma.topic.deleteMany()
  await prisma.chapter.deleteMany()
  await prisma.course.deleteMany()
  await prisma.subject.deleteMany()
  await prisma.classLevel.deleteMany()
  await prisma.board.deleteMany()

  console.log('→ boards & classes')
  const cbse = await prisma.board.create({ data: { code: 'CBSE', name: 'Central Board of Secondary Education' } })
  await prisma.board.create({ data: { code: 'ICSE', name: 'Indian Certificate of Secondary Education' } })

  const classes = await Promise.all(
    CLASS_LEVELS.map((c, i) =>
      prisma.classLevel.create({
        data: {
          boardId: cbse.id,
          slug: c.slug,
          label: c.label,
          grade: c.grade,
          stream: c.stream ?? 'GENERAL',
          sortKey: i,
          bundlePricePaise: c.slug === 'class-8' ? 27_000_00 : null,
          bundleListPricePaise: c.slug === 'class-8' ? 36_000_00 : null,
        },
      }),
    ),
  )
  const class8 = classes.find((c) => c.slug === 'class-8')!

  console.log('→ subjects')
  // Built from SUBJECT_META so the senior-secondary streams can introduce
  // Physics, Accountancy and the rest without a second place to edit.
  const subjectBySlug = new Map<string, { id: string }>()
  for (const [slug, meta] of Object.entries(SUBJECT_META)) {
    subjectBySlug.set(
      slug,
      await prisma.subject.create({
        data: { slug, ...meta, sortKey: Object.keys(SUBJECT_META).indexOf(slug) },
      }),
    )
  }
  const subject = (slug: string) => {
    const found = subjectBySlug.get(slug)
    if (!found) throw new Error(`Subject "${slug}" is missing from SUBJECT_META`)
    return found
  }

  const maths = subject('maths')
  const science = subject('science')
  const ai = subject('ai-gen-ai')

  console.log('→ courses, chapters, topics')
  const plan: Array<[string, string, ChapterSeed[], 'VIDEO' | 'ACTIVITY', number]> = [
    [maths.id, 'maths', CLASS8_MATHS, 'VIDEO', 0],
    [science.id, 'science', CLASS8_SCIENCE, 'VIDEO', 1],
    [ai.id, 'ai-gen-ai', CLASS8_AI, 'ACTIVITY', 2],
  ]

  let questionCount = 0

  for (const [subjectId, subjectSlug, chapters, kind, sortKey] of plan) {
    const course = await prisma.course.create({
      data: { classLevelId: class8.id, subjectId, pricePaise: SUBJECT_PRICE_PAISE, sortKey },
    })

    for (const [i, ch] of chapters.entries()) {
      const total = dur(ch.duration)
      const per = Math.round(total / ch.topics)
      const chapter = await prisma.chapter.create({
        data: {
          courseId: course.id,
          index: i + 1,
          title: ch.title,
          // Chapter 1 of every course is free — mirrors the live product's rule.
          isFree: i === 0,
          topics: {
            create: Array.from({ length: ch.topics }, (_, t) => ({
              index: t + 1,
              title: `${ch.title} — Part ${t + 1}`,
              kind,
              durationSec: t === ch.topics - 1 ? total - per * (ch.topics - 1) : per,
              videoUrl: DEMO_HLS,
            })),
          },
        },
      })

      // Chapters without a hand-written quiz fall back to the AI practice
      // generator, so a missing key here is expected, not an error.
      const quiz = QUESTIONS[`${subjectSlug}:${i + 1}`]
      if (quiz?.length) {
        await prisma.question.createMany({
          data: quiz.map((q, qi) => ({
            chapterId: chapter.id,
            index: qi + 1,
            kind: q.kind,
            prompt: q.prompt,
            options: q.options ?? [],
            answer: q.answer,
            explanation: q.explanation ?? null,
            difficulty: q.difficulty ?? 1,
            marks: q.marks ?? 1,
          })),
        })
        questionCount += quiz.length
      }
    }
  }

  // Remaining classes come straight from SYLLABUS, which names its own subjects
  // per class — Class 11/12 are Physics/Chemistry/Biology/Maths and the commerce
  // streams are Accountancy/Business Studies/Economics, not the maths + science
  // pair that middle school uses.
  for (const cl of classes.filter((c) => c.slug !== 'class-8')) {
    const syllabus = SYLLABUS[cl.slug]
    if (!syllabus) {
      console.warn(`  ! no syllabus for ${cl.slug} — skipping`)
      continue
    }

    for (const [i, entry] of syllabus.entries()) {
      const course = await prisma.course.create({
        data: {
          classLevelId: cl.id,
          subjectId: subject(entry.slug).id,
          pricePaise: SUBJECT_PRICE_PAISE,
          sortKey: i,
        },
      })

      for (const [ci, ch] of entry.chapters.entries()) {
        await prisma.chapter.create({
          data: {
            courseId: course.id,
            index: ci + 1,
            title: ch.title,
            isFree: ci === 0,
            // No videoUrl: these lessons have not been produced, and the player
            // already renders "still in production" for a topic without one.
            topics: {
              create: Array.from({ length: ch.topics }, (_, t) => ({
                index: t + 1,
                title: `${ch.title} — Part ${t + 1}`,
                kind: 'VIDEO' as const,
                durationSec: 0,
              })),
            },
          },
        })
      }
    }
  }

  console.log('→ demo users')
  const passwordHash = await bcrypt.hash('password123', 10)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  await prisma.user.create({
    data: {
      email: 'student@paperpath.dev',
      passwordHash,
      name: 'Aarav Sharma',
      boardId: cbse.id,
      classLevelId: class8.id,
      dailyCredits: 5,
      creditsGrantedOn: today,
    },
  })

  await prisma.user.create({
    data: {
      email: 'teacher@paperpath.dev',
      passwordHash,
      name: 'Anita Rao',
      role: 'TEACHER',
      boardId: cbse.id,
      classLevelId: class8.id,
      dailyCredits: 50,
      dailyCreditCap: 50,
      creditsGrantedOn: today,
      consentAcceptedAt: new Date(),
    },
  })

  await prisma.user.create({
    data: {
      email: 'admin@paperpath.dev',
      passwordHash,
      name: 'Content Admin',
      role: 'ADMIN',
      boardId: cbse.id,
      classLevelId: class8.id,
      dailyCredits: 50,
      dailyCreditCap: 50,
      creditsGrantedOn: today,
      consentAcceptedAt: new Date(),
    },
  })

  const premium = await prisma.user.create({
    data: {
      email: 'premium@paperpath.dev',
      passwordHash,
      name: 'Diya Patel',
      boardId: cbse.id,
      classLevelId: class8.id,
      dailyCredits: 50,
      dailyCreditCap: 50,
      creditsGrantedOn: today,
    },
  })

  const endsAt = new Date()
  endsAt.setFullYear(endsAt.getFullYear() + 1)
  await prisma.subscription.create({
    data: {
      userId: premium.id,
      scope: 'CLASS',
      classLevelId: class8.id,
      pricePaise: 27_000_00,
      endsAt,
    },
  })

  // Same account the standalone `npm run db:tester` creates, so a reset does not
  // quietly leave the client without the login they were given.
  console.log('→ guided-practice test account')
  await seedTester(prisma)
  console.log(`  ${TESTER_EMAIL}`)

  const counts = {
    chapters: await prisma.chapter.count(),
    topics: await prisma.topic.count(),
    courses: await prisma.course.count(),
    questions: await prisma.question.count(),
  }
  console.log('✔ seeded', counts, `(${questionCount} questions across quizzed chapters)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
