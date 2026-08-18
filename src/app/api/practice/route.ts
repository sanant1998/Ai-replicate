import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'
import { refundCredit, spendCredit, tutorBudgetExhausted } from '@/lib/credits'
import { canAccessChapter, getEntitlements } from '@/lib/access'
import { clientIp, hit, hitIp } from '@/lib/rate-limit'
import { languageInstruction } from '@/lib/language'
import { reportError } from '@/lib/observability'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * The practice generator that prisma/questions.ts and prisma/seed.ts have both
 * pointed at since they were written — "the rest fall back to the AI practice
 * generator in Tools" — and which did not exist. Only 29 hand-written questions
 * cover 6 chapters out of 44, so every other chapter offered a student nothing
 * to practise on.
 *
 * Hand-written questions stay the real thing: they are marked server-side,
 * scored, and count towards Performance. These are practice only, generated on
 * demand and never stored, which is why they cost a tutor credit rather than
 * pretending to be an exam.
 */
const Body = z.object({
  chapterId: z.string().optional(),
  topic: z.string().trim().min(3).max(200).optional(),
  count: z.coerce.number().int().min(1).max(5).default(3),
})

const Question = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  working: z.string().default(''),
})

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

const USER_LIMIT = { max: 6, windowMs: 60_000 }
const IP_LIMIT = { max: 20, windowMs: 60_000 }

export async function POST(req: Request) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const byUser = await hit(`practice:u:${session.uid}`, USER_LIMIT.max, USER_LIMIT.windowMs)
  if (!byUser.ok) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Slow down a moment and try again.' },
      { status: 429, headers: { 'retry-after': String(byUser.retryAfterSec) } },
    )
  }
  const byIp = await hitIp('practice:ip', clientIp(req), IP_LIMIT.max, IP_LIMIT.windowMs)
  if (!byIp.ok) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Slow down a moment and try again.' },
      { status: 429, headers: { 'retry-after': String(byIp.retryAfterSec) } },
    )
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'UNCONFIGURED', message: 'The practice generator is not configured on this server.' },
      { status: 503 },
    )
  }

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.uid },
    include: { classLevel: true, board: true },
  })

  // Same gate as the player and the tutor: a chapter you cannot watch is a
  // chapter you cannot generate questions from.
  let chapter = null
  if (parsed.data.chapterId) {
    chapter = await prisma.chapter.findUnique({
      where: { id: parsed.data.chapterId },
      include: { course: { include: { subject: true } }, topics: { orderBy: { index: 'asc' } } },
    })
    if (chapter) {
      const ent = await getEntitlements(user.id)
      if (!canAccessChapter(chapter, chapter.course, ent)) {
        return NextResponse.json({ error: 'LOCKED' }, { status: 403 })
      }
    }
  }

  if (!chapter && !parsed.data.topic) {
    return NextResponse.json(
      { error: 'NO_SUBJECT', message: 'Pick a chapter or type what you want to practise.' },
      { status: 400 },
    )
  }

  if (await tutorBudgetExhausted()) {
    return NextResponse.json(
      {
        error: 'BUDGET_EXHAUSTED',
        message: 'Practice questions have reached their limit for today. Back tomorrow.',
      },
      { status: 503, headers: { 'retry-after': '3600' } },
    )
  }

  const subject = chapter
    ? `${chapter.course.subject.name}, Chapter ${chapter.index}: ${chapter.title}`
    : parsed.data.topic!

  const paid = await spendCredit(user.id, `Practice: ${subject.slice(0, 80)}`)
  if (!paid) {
    return NextResponse.json(
      { error: 'OUT_OF_CREDITS', message: 'You have used all your credits for today.' },
      { status: 402 },
    )
  }

  // "JSON only" is load-bearing: scripts/mock-openai.mjs keys its practice
  // fixture off that phrase, so the phrasing here and there must agree.
  const system = [
    `You write practice questions for a ${user.classLevel?.label ?? 'school'} student following the ${user.board?.code ?? 'CBSE'} syllabus in India.`,
    `Write exactly ${parsed.data.count} questions on: ${subject}.`,
    chapter?.topics.length
      ? `The chapter covers: ${chapter.topics.map((t) => t.title).join('; ')}.`
      : '',
    'Mix easier and harder ones. Use the notation the student meets in their textbook.',
    languageInstruction(user.language) ?? '',
    'Write mathematics in LaTeX between single $ for inline and $$ for display.',
    'Reply with JSON only — an array of objects with the keys "question", "answer" and "working". No prose around it, no markdown fence.',
  ]
    .filter(Boolean)
    .join('\n')

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const completion = await openai.chat.completions.create(
      {
        model: MODEL,
        max_completion_tokens: 1200,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Give me ${parsed.data.count} practice questions.` },
        ],
      },
      { signal: req.signal },
    )

    const raw = completion.choices[0]?.message?.content ?? ''
    const questions = parseQuestions(raw)
    if (questions.length === 0) throw new Error('The model did not return usable questions')

    return NextResponse.json({ subject, questions })
  } catch (err) {
    // The credit is spent before the call, because that is the only order in
    // which two parallel requests cannot both take the last one. Hand it back
    // when nothing came of it.
    await refundCredit(user.id, 'Practice generation failed').catch((refundErr) =>
      reportError('practice/refund', refundErr, { userId: user.id }),
    )
    if (req.signal.aborted) return new Response(null, { status: 499 })
    reportError('practice/model', err, { userId: user.id, model: MODEL })
    return NextResponse.json(
      { error: 'UPSTREAM', message: 'Could not write questions just now. Please try again.' },
      { status: 502 },
    )
  }
}

/**
 * Models wrap JSON in a fence roughly half the time however firmly you ask, so
 * strip one if it is there rather than failing on formatting and charging the
 * student for it.
 */
function parseQuestions(raw: string) {
  const body = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  let value: unknown
  try {
    value = JSON.parse(body)
  } catch {
    return []
  }
  const list = Array.isArray(value) ? value : []
  return list.flatMap((item) => {
    const parsed = Question.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}
