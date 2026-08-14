import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'
import { assertTopicAccess } from '@/lib/access'
import { hit } from '@/lib/rate-limit'

const Body = z.object({
  topicId: z.string().min(1),
  positionSec: z.number().int().min(0).max(60 * 60 * 12),
  completed: z.boolean().optional(),
})

export async function POST(req: Request) {
  const session = await readSession()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // The player posts a heartbeat every few seconds; this only trips on abuse.
  const burst = hit(`progress:u:${session.uid}`, 60, 60_000)
  if (!burst.ok) {
    return NextResponse.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'retry-after': String(burst.retryAfterSec) } },
    )
  }

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { topicId, positionSec, completed } = parsed.data

  // Never trust the client about what it's allowed to watch.
  const access = await assertTopicAccess(topicId, session.uid)
  if (!access.ok) {
    return NextResponse.json(
      { error: access.reason },
      { status: access.reason === 'NOT_FOUND' ? 404 : 403 },
    )
  }

  const progress = await prisma.progress.upsert({
    where: { userId_topicId: { userId: session.uid, topicId } },
    create: { userId: session.uid, topicId, positionSec, completed: completed ?? false },
    update: { positionSec, ...(completed === undefined ? {} : { completed }) },
  })

  return NextResponse.json({ ok: true, progress })
}
