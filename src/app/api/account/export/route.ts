import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/session'
import { hit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Everything this account holds, as one JSON file.
 *
 * The DPDP Act 2023 gives a data principal the right to a copy of their data,
 * and for a minor that request will usually come from a parent who wants to see
 * what the app knows. A route handler rather than a server action because the
 * result is a download, and downloads need Content-Disposition.
 *
 * The password hash and reset tokens are excluded: they are credentials rather
 * than personal data, and mailing a bcrypt hash to whoever asks helps only an
 * attacker.
 */
export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // The query fans out across nine tables; one export an hour is plenty.
  const burst = await hit(`export:${user.id}`, 3, 60 * 60_000)
  if (!burst.ok) {
    return NextResponse.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'retry-after': String(burst.retryAfterSec) } },
    )
  }

  const [progress, notes, bookmarks, attempts, chats, payments, subscriptions, credits] =
    await Promise.all([
      prisma.progress.findMany({
        where: { userId: user.id },
        include: { topic: { select: { title: true } } },
      }),
      prisma.note.findMany({
        where: { userId: user.id },
        include: { topic: { select: { title: true } } },
      }),
      prisma.bookmark.findMany({
        where: { userId: user.id },
        include: { chapter: { select: { title: true } } },
      }),
      prisma.quizAttempt.findMany({
        where: { userId: user.id },
        include: { chapter: { select: { title: true } }, answers: true },
      }),
      prisma.chatSession.findMany({
        where: { userId: user.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      }),
      prisma.payment.findMany({ where: { userId: user.id } }),
      prisma.subscription.findMany({ where: { userId: user.id } }),
      prisma.creditLedger.findMany({ where: { userId: user.id } }),
    ])

  const payload = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      board: user.board?.code ?? null,
      class: user.classLevel?.label ?? null,
      emailVerifiedAt: user.emailVerifiedAt,
      consentAcceptedAt: user.consentAcceptedAt,
      createdAt: user.createdAt,
    },
    progress,
    notes,
    bookmarks,
    quizAttempts: attempts,
    tutorConversations: chats,
    payments,
    subscriptions,
    creditLedger: credits,
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="paperpath-export-${user.id}.json"`,
      'cache-control': 'no-store',
    },
  })
}
