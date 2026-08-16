import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'
import { refundCredit, spendCredit, tutorBudgetExhausted } from '@/lib/credits'
import { canAccessChapter, getEntitlements } from '@/lib/access'
import { clientIp, hit, hitIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const Body = z.object({
  sessionId: z.string().optional(),
  chapterId: z.string().optional(),
  mode: z.enum(['career']).optional(),
  message: z.string().min(1).max(4000),
})

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

function systemPrompt(ctx: {
  studentName: string
  classLabel: string | null
  boardCode: string | null
  chapter?: { subject: string; index: number; title: string; topics: string[] }
}) {
  const lines = [
    `You are the PaperPath AI tutor. You are helping ${ctx.studentName}, a ${ctx.classLabel ?? 'school'} student following the ${ctx.boardCode ?? 'CBSE'} syllabus in India.`,
    '',
    'How to answer:',
    '- Answer the question directly. Lead with the result, then show the working that gets there.',
    '- Never withhold an answer to make the student guess, and never reply with only a counter-question. If they ask what 2 x 8 is, the reply contains 16.',
    '- Keep the working tight enough to follow and learn from — steps, not padding.',
    '- Answer questions from any subject or none: general knowledge, homework, exam strategy, or a definition. Being off-syllabus is not a reason to deflect.',
    '- Use the notation and vocabulary the student already meets in their textbook.',
    '- Write mathematics in LaTeX between single $ for inline and $$ for display, e.g. $2 \\times 8 = 16$. Never use \\( \\) or \\[ \\].',
    '- Use markdown — headings, bold, and lists — when it makes an answer easier to read.',
    '- If you are unsure or the question is ambiguous, say so plainly instead of inventing an answer.',
  ]

  if (ctx.chapter) {
    lines.push(
      '',
      `The student is currently on ${ctx.chapter.subject}, Chapter ${ctx.chapter.index}: ${ctx.chapter.title}.`,
      `Topics in this chapter: ${ctx.chapter.topics.join('; ')}.`,
      'Anchor examples and analogies in this chapter wherever it is natural to do so.',
    )
  }

  return lines.join('\n')
}

function careerPrompt(ctx: { studentName: string; classLabel: string | null; boardCode: string | null }) {
  return [
    `You are the PaperPath career guide. You are advising ${ctx.studentName}, a ${ctx.classLabel ?? 'school'} student on the ${ctx.boardCode ?? 'CBSE'} syllabus in India.`,
    '',
    'How to advise:',
    '- Ground everything in the Indian system: streams after Class 10, board exams, JEE/NEET/CUET/CLAT, ITI and diploma routes, and state quotas.',
    '- Ask what the student enjoys and is good at before recommending anything.',
    '- Give two or three concrete options with the subjects each one needs, not one prescription.',
    '- Name the realistic entry routes, including ones that do not need an expensive coaching class.',
    '- Never promise admission, salary figures, or cut-offs as fact — describe ranges and tell them to verify with the official board or exam body.',
    '- Keep the student in the driving seat. They are a minor; suggest they talk it through with a parent or teacher for any irreversible choice.',
  ].join('\n')
}

/** Per-account burst cap, and a wider cap on the IP behind it. */
const USER_LIMIT = { max: 10, windowMs: 60_000 }
const IP_LIMIT = { max: 30, windowMs: 60_000 }

function tooMany(verdict: { retryAfterSec: number }) {
  return NextResponse.json(
    { error: 'RATE_LIMITED', message: 'You are sending messages too quickly. Try again shortly.' },
    { status: 429, headers: { 'retry-after': String(verdict.retryAfterSec) } },
  )
}

export async function POST(req: Request) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // Rate limit before any database work so a flood costs almost nothing.
  const byUser = await hit(`tutor:u:${session.uid}`, USER_LIMIT.max, USER_LIMIT.windowMs)
  if (!byUser.ok) return tooMany(byUser)

  const byIp = await hitIp('tutor:ip', clientIp(req), IP_LIMIT.max, IP_LIMIT.windowMs)
  if (!byIp.ok) return tooMany(byIp)

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured on the server.' },
      { status: 503 },
    )
  }

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { message } = parsed.data

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.uid },
    include: { classLevel: true, board: true },
  })

  // ---- chapter context, gated by the same entitlement rules as the player ---
  let chapter = null
  if (parsed.data.chapterId) {
    chapter = await prisma.chapter.findUnique({
      where: { id: parsed.data.chapterId },
      include: {
        course: { include: { subject: true } },
        topics: { orderBy: { index: 'asc' } },
      },
    })
    if (chapter) {
      const ent = await getEntitlements(user.id)
      if (!canAccessChapter(chapter, chapter.course, ent)) {
        return NextResponse.json({ error: 'LOCKED' }, { status: 403 })
      }
    }
  }

  // ---- budget --------------------------------------------------------------
  // Checked before the credit is spent, so hitting the site-wide ceiling costs
  // the student nothing. Deliberately after the entitlement check and before
  // any call to the model: this is the last gate that can still say no for
  // free.
  if (await tutorBudgetExhausted()) {
    console.error('[tutor] daily site-wide model budget exhausted — refusing further requests')
    return NextResponse.json(
      {
        error: 'BUDGET_EXHAUSTED',
        message: 'The tutor has reached its limit for today. It will be back tomorrow.',
      },
      { status: 503, headers: { 'retry-after': '3600' } },
    )
  }

  // ---- credits -------------------------------------------------------------
  const paid = await spendCredit(user.id, chapter ? `Chapter: ${chapter.title}` : 'General question')
  if (!paid) {
    return NextResponse.json(
      { error: 'OUT_OF_CREDITS', message: 'You have used all your credits for today.' },
      { status: 402 },
    )
  }

  // ---- persist the turn ----------------------------------------------------
  const mode = parsed.data.mode === 'career' ? 'CAREER' : 'TUTOR'

  // Match the mode as well as the owner. A session carries one system prompt,
  // so replaying a career conversation under the tutor prompt (or the reverse)
  // would hand the model a history written by a different persona.
  let chatSession = parsed.data.sessionId
    ? await prisma.chatSession.findFirst({
        where: { id: parsed.data.sessionId, userId: user.id, mode },
      })
    : null

  if (!chatSession) {
    chatSession = await prisma.chatSession.create({
      data: {
        userId: user.id,
        chapterId: chapter?.id ?? null,
        mode,
        title: message.slice(0, 60),
      },
    })
  }

  await prisma.chatMessage.create({
    data: { sessionId: chatSession.id, role: 'USER', content: message },
  })

  // The newest 40, then flipped back into reading order. Taking 40 ascending
  // would pin the window to the *oldest* messages, so past turn 40 the model
  // would stop seeing the question it is being asked.
  const history = (
    await prisma.chatMessage.findMany({
      where: { sessionId: chatSession.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 40,
    })
  ).reverse()

  // baseURL is left to the SDK, which reads OPENAI_BASE_URL — that is how
  // scripts/mock-openai.mjs stands in for the real API in development.
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const sessionId = chatSession.id

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      // Once the student navigates away the controller is closed, and enqueuing
      // into a closed controller throws. Swallow that: the work left to do is
      // saving the partial answer, not talking to a browser that has gone.
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          /* client is gone */
        }
      }

      send('session', { sessionId })

      let full = ''
      try {
        // OpenAI has no separate `system` parameter — the instructions ride at
        // the head of the message array instead.
        const system =
          parsed.data.mode === 'career'
            ? careerPrompt({
                studentName: user.name,
                classLabel: user.classLevel?.label ?? null,
                boardCode: user.board?.code ?? null,
              })
            : systemPrompt({
                studentName: user.name,
                classLabel: user.classLevel?.label ?? null,
                boardCode: user.board?.code ?? null,
                chapter: chapter
                  ? {
                      subject: chapter.course.subject.name,
                      index: chapter.index,
                      title: chapter.title,
                      topics: chapter.topics.map((t) => t.title),
                    }
                  : undefined,
              })

        const completion = await openai.chat.completions.create(
          {
            model: MODEL,
            max_completion_tokens: 1500,
            stream: true,
            messages: [
              { role: 'system' as const, content: system },
              ...history.map((m) => ({
                role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
                content: m.content,
              })),
            ],
          },
          // Hand the client's disconnect straight through to OpenAI. Without
          // it, closing the tab leaves the completion running to its token
          // limit and we pay for an answer nobody will ever read.
          { signal: req.signal },
        )

        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content
          if (text) {
            full += text
            send('delta', { text })
          }
        }
      } catch (err) {
        // A disconnect is not a failure. The student got whatever had streamed
        // by the time they left, so it is kept and charged for; anything else
        // means the answer never came, and a credit was spent for nothing.
        if (!req.signal.aborted) {
          if (!full) {
            await refundCredit(user.id, 'Tutor request failed').catch((refundErr) =>
              console.error('[tutor] credit refund failed', refundErr),
            )
          }
          send('error', {
            message: err instanceof Error ? err.message : 'The tutor is unavailable.',
          })
        }
      } finally {
        if (full) {
          await prisma.chatMessage.create({
            data: { sessionId, role: 'ASSISTANT', content: full },
          })
          await prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } })
        }
        send('done', { ok: true })
        try {
          controller.close()
        } catch {
          /* already closed by the disconnect */
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
