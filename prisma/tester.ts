import bcrypt from 'bcryptjs'
import type { PrismaClient } from '../src/generated/prisma/client.js'
import { SUBJECT_META } from './syllabus.js'

/**
 * The client's test account, and the Chemistry topic it exists to try.
 *
 * Idempotent on purpose, and separate from seed.ts, which starts by deleting
 * every row it is about to write. This runs against a database with real data
 * in it — the client's material lives in `Topic.content`, and a seeder that
 * wiped and recreated the topic would take the material with it every time
 * somebody ran it. So: upsert the account, upsert the scaffolding, and never
 * touch content that is already there.
 */

export const TESTER_EMAIL = 'yashikaarora@test.com'
const TESTER_PASSWORD = 'yashika@123'
const TESTER_NAME = 'Yashika Arora'

const TOPIC_TITLE = 'Test Topic'

/**
 * Placeholder material, so the account works the moment it is created rather
 * than showing an empty list until someone gets round to pasting the real
 * thing. Written to say plainly that it is a placeholder — the failure mode
 * worth avoiding is the client reading a demo answer and thinking it came from
 * their syllabus. Replaced from Content Admin → the chapter → Material.
 */
const PLACEHOLDER_CONTENT = `PLACEHOLDER MATERIAL — replace this from the admin panel.

An atom is the smallest particle of an element that can take part in a chemical
reaction. It has a nucleus containing protons and neutrons, with electrons
arranged in shells around it.

- Atomic number (Z) is the number of protons in the nucleus.
- Mass number (A) is the number of protons plus neutrons.
- Number of neutrons = A - Z.
- In a neutral atom, the number of electrons equals the number of protons.

Electrons fill shells outward from the nucleus. Shell capacity is given by
$2n^2$, where n is the shell number: 2 electrons in the first shell, 8 in the
second, 18 in the third.

Isotopes are atoms of the same element with the same atomic number but different
mass numbers — for example carbon-12 and carbon-14, both with Z = 6.`

const PLACEHOLDER_ANSWERS = [
  {
    index: 1,
    question: 'What is the atomic number of an element?',
    answer: 'The atomic number (Z) is the number of protons in the nucleus of an atom.',
    steps: [
      'Look at what sits inside the nucleus: protons and neutrons.',
      'The atomic number counts the protons only — neutrons are not included.',
      'In a neutral atom the electrons match the protons, so Z also gives the electron count.',
    ],
  },
  {
    index: 2,
    question: 'How many electrons fit in the second shell?',
    answer: '8 electrons.',
    steps: [
      'Shell capacity is $2n^2$, where n is the shell number.',
      'For the second shell, n = 2.',
      '$2 \\times 2^2 = 2 \\times 4 = 8$.',
    ],
  },
]

export async function seedTester(prisma: PrismaClient) {
  const board = await prisma.board.findFirst({ where: { code: 'CBSE' } })
  if (!board) throw new Error('No CBSE board found — run `npm run db:seed` first.')

  // Chemistry is a Class 11 subject in this catalog. Reused if the class is
  // already there, which it is after a normal seed.
  const classLevel =
    (await prisma.classLevel.findFirst({ where: { boardId: board.id, slug: 'class-11' } })) ??
    (await prisma.classLevel.create({
      data: { boardId: board.id, slug: 'class-11', label: 'Class - 11th', grade: 11, sortKey: 11 },
    }))

  const meta = SUBJECT_META.chemistry
  const subject =
    (await prisma.subject.findFirst({ where: { slug: 'chemistry' } })) ??
    (await prisma.subject.create({ data: { slug: 'chemistry', ...meta, sortKey: 20 } }))

  const course =
    (await prisma.course.findFirst({
      where: { classLevelId: classLevel.id, subjectId: subject.id },
    })) ??
    (await prisma.course.create({
      data: { classLevelId: classLevel.id, subjectId: subject.id, pricePaise: 0, sortKey: 20 },
    }))

  // isFree, so the topic is reachable by an ordinary account too — useful when
  // the client wants to see it from a normal login rather than the test one.
  const chapter =
    (await prisma.chapter.findFirst({ where: { courseId: course.id, index: 1 } })) ??
    (await prisma.chapter.create({
      data: {
        courseId: course.id,
        index: 1,
        title: 'Guided Practice',
        isFree: true,
        summary: 'The chapter the guided tutor is being tried on.',
      },
    }))

  let topic = await prisma.topic.findFirst({ where: { chapterId: chapter.id, index: 1 } })
  if (!topic) {
    topic = await prisma.topic.create({
      data: { chapterId: chapter.id, index: 1, title: TOPIC_TITLE, kind: 'ACTIVITY' },
    })
  }

  // Fill, never overwrite. An empty topic gets the placeholder so the account
  // works the moment it exists; a topic somebody has written material for is
  // left exactly as it is, because that material is the client's and this
  // script is expected to be run again.
  if (!topic.content?.trim()) {
    topic = await prisma.topic.update({
      where: { id: topic.id },
      data: { content: PLACEHOLDER_CONTENT },
    })
  }

  // Same rule for the answer key: demo entries only where there is no key at
  // all, so a re-run cannot salt the client's answers with ours.
  const existingAnswers = await prisma.topicAnswer.count({ where: { topicId: topic.id } })
  if (existingAnswers === 0) {
    for (const entry of PLACEHOLDER_ANSWERS) {
      await prisma.topicAnswer.create({ data: { topicId: topic.id, ...entry } })
    }
  }

  const passwordHash = await bcrypt.hash(TESTER_PASSWORD, 10)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const user = await prisma.user.upsert({
    where: { email: TESTER_EMAIL },
    // The password is reset on every run, so the login in the handover note is
    // always the login that works.
    update: { passwordHash, testMode: true, boardId: board.id, classLevelId: classLevel.id },
    create: {
      email: TESTER_EMAIL,
      passwordHash,
      name: TESTER_NAME,
      testMode: true,
      boardId: board.id,
      classLevelId: classLevel.id,
      // Credits are not spent by a test account, but the columns are read on
      // every page load and a coherent value costs nothing.
      dailyCredits: 50,
      dailyCreditCap: 50,
      creditsGrantedOn: today,
      // Not a child's account and not a real address: the consent gate and the
      // verification nudge would both be asking a question nobody can answer.
      consentAcceptedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
  })

  return { user, topic, chapter, course, subject, classLevel }
}
