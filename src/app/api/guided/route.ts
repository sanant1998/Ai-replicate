import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'
import { refundCredit, spendCredit, tutorBudgetExhausted } from '@/lib/credits'
import { canAccessChapter, getEntitlements } from '@/lib/access'
import { clientIp, hit, hitIp } from '@/lib/rate-limit'
import {
  GUIDED_SCHEMA,
  guidedPrompt,
  replayAssistant,
  resolveAnswer,
  type GuidedAnswer,
} from '@/lib/guided'

export const runtime = 'nodejs'
export const maxDuration = 60

const Body = z.object({
  topicId: z.string().min(1),
  sessionId: z.string().optional(),
  message: z.string().min(1).max(2000),
})

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

/**
 * How much of the answer key one request may carry.
 *
 * Every entry is prompt tokens on every message, so an unbounded key is an
 * unbounded bill. Sixty covers a topic's worth of questions with room to spare;
 * past that the topic wants splitting, which is a content decision and belongs
 * with the person writing the content, not with a silent truncation here.
 */
const ANSWER_KEY_LIMIT = 60

const USER_LIMIT = { max: 10, windowMs: 60_000 }
const IP_LIMIT = { max: 30, windowMs: 60_000 }

function tooMany(verdict: { retryAfterSec: number }) {
  return NextResponse.json(
    { error: 'RATE_LIMITED', message: 'You are sending questions too quickly. Try again shortly.' },
    { status: 429, headers: { 'retry-after': String(verdict.retryAfterSec) } },
  )
}

export async function POST(req: Request) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const byUser = await hit(`guided:u:${session.uid}`, USER_LIMIT.max, USER_LIMIT.windowMs)
  if (!byUser.ok) return tooMany(byUser)

  const byIp = await hitIp('guided:ip', clientIp(req), IP_LIMIT.max, IP_LIMIT.windowMs)
  if (!byIp.ok) return tooMany(byIp)

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured on the server.' },
      { status: 503 },
    )
  }

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { message, topicId } = parsed.data

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.uid },
    include: { classLevel: true, board: true },
  })

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      chapter: { include: { course: { include: { subject: true } } } },
      answers: { orderBy: { index: 'asc' }, take: ANSWER_KEY_LIMIT },
    },
  })
  // No material, no guided practice. Reported as NOT_FOUND rather than as an
  // empty answer, because a topic without material is not a topic this mode
  // offers at all — the picker never lists it.
  if (!topic?.content?.trim()) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  // Test accounts exist to exercise this one screen, so they are not held to
  // the subscription that gates the rest of the product. Everyone else is.
  if (!user.testMode) {
    const ent = await getEntitlements(user.id)
    if (!canAccessChapter(topic.chapter, topic.chapter.course, ent)) {
      return NextResponse.json({ error: 'LOCKED' }, { status: 403 })
    }
  }

  // The deployment-wide ceiling still applies to testers. It is the only thing
  // between a stuck loop and an unbounded invoice, and a test account is if
  // anything more likely to be the thing that gets stuck.
  if (await tutorBudgetExhausted()) {
    console.error('[guided] daily site-wide model budget exhausted — refusing further requests')
    return NextResponse.json(
      {
        error: 'BUDGET_EXHAUSTED',
        message: 'The tutor has reached its limit for today. It will be back tomorrow.',
      },
      { status: 503, headers: { 'retry-after': '3600' } },
    )
  }

  // Credits are the free tier's cost control, and a tester has no free tier to
  // control — they would spend the day's five before finishing the first topic.
  const charged = !user.testMode
  if (charged) {
    const paid = await spendCredit(user.id, `Guided: ${topic.title}`)
    if (!paid) {
      return NextResponse.json(
        { error: 'OUT_OF_CREDITS', message: 'You have used all your credits for today.' },
        { status: 402 },
      )
    }
  }

  let chatSession = parsed.data.sessionId
    ? await prisma.chatSession.findFirst({
        where: { id: parsed.data.sessionId, userId: user.id, mode: 'GUIDED', topicId: topic.id },
      })
    : null

  if (!chatSession) {
    chatSession = await prisma.chatSession.create({
      data: {
        userId: user.id,
        chapterId: topic.chapterId,
        topicId: topic.id,
        mode: 'GUIDED',
        title: message.slice(0, 60),
      },
    })
  }

  await prisma.chatMessage.create({
    data: { sessionId: chatSession.id, role: 'USER', content: message },
  })

  // Newest first, then flipped back — same reason as /api/tutor: taking the
  // oldest would eventually stop showing the model the question being asked.
  // Shorter window than the tutor's, because each guided turn also carries the
  // material and the answer key.
  const history = (
    await prisma.chatMessage.findMany({
      where: { sessionId: chatSession.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 12,
    })
  ).reverse()

  const answerKey = topic.answers.map((a) => ({
    question: a.question,
    answer: a.answer,
    steps: a.steps,
  }))

  const system = guidedPrompt({
    studentName: user.name,
    language: user.language,
    subject: topic.chapter.course.subject.name,
    chapterTitle: topic.chapter.title,
    topicTitle: topic.title,
    content: topic.content,
    answerKey,
  })

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const completion = await openai.chat.completions.create(
      {
        model: MODEL,
        max_completion_tokens: 900,
        // Not streamed, deliberately. A stepped answer is only useful once it
        // is whole — the interface hands the steps over one at a time, so the
        // student would spend the stream watching text they are not allowed to
        // read yet. Asking for it as one object is also what lets the schema be
        // enforced rather than parsed out of prose.
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'guided_answer', strict: true, schema: GUIDED_SCHEMA },
        },
        messages: [
          { role: 'system' as const, content: system },
          ...history.map((m) => ({
            role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
            content: m.role === 'USER' ? m.content : replayAssistant(m.content, m.steps),
          })),
        ],
      },
      { signal: req.signal },
    )

    const raw = completion.choices[0]?.message?.content
    if (!raw) throw new Error('The tutor returned nothing.')

    const reply = resolveAnswer(JSON.parse(raw) as GuidedAnswer, topic.title, answerKey)

    const saved = await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: 'ASSISTANT',
        content: reply.answer,
        steps: reply.steps,
      },
    })
    await prisma.chatSession.update({
      where: { id: chatSession.id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      sessionId: chatSession.id,
      id: saved.id,
      answer: reply.answer,
      steps: reply.steps,
      onTopic: reply.onTopic,
      charged,
    })
  } catch (err) {
    // A disconnect is not a failure and needs no refund — but nothing was
    // delivered either way here, since the reply only exists once it is whole.
    if (charged && !req.signal.aborted) {
      await refundCredit(user.id, 'Guided request failed').catch((refundErr) =>
        console.error('[guided] credit refund failed', refundErr),
      )
    }
    console.error('[guided]', err)
    return NextResponse.json(
      { error: 'UPSTREAM', message: 'The tutor is unavailable right now. Try again.' },
      { status: 502 },
    )
  }
}
