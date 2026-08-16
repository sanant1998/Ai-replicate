import { NextResponse } from 'next/server'
import { readSession } from '@/lib/session'
import { assertTopicAccess } from '@/lib/access'
import { clientIp, hit, hitIp } from '@/lib/rate-limit'
import { upstreamUrl, verifyPlaybackTicket } from '@/lib/video'

export const runtime = 'nodejs'

/**
 * Resolves a playback ticket into the real stream.
 *
 * Both gates are checked on every request, not just at page render: the ticket
 * proves this URL was issued to this account recently, and the entitlement
 * check proves the account still has access — so a refund or an expired
 * subscription cuts playback off mid-session rather than at next page load.
 */
export async function GET(req: Request, ctx: RouteContext<'/api/video/[topicId]'>) {
  const { topicId } = await ctx.params
  const session = await readSession()
  const userId = session?.uid ?? null

  // Signed-in traffic is bucketed by account; anonymous traffic (free chapters)
  // has nothing else to key on, so it falls back to the IP rules.
  const burst = userId
    ? await hit(`video:u:${userId}`, 60, 60_000)
    : await hitIp('video:ip', clientIp(req), 60, 60_000)
  if (!burst.ok) {
    return NextResponse.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'retry-after': String(burst.retryAfterSec) } },
    )
  }

  const ticket = new URL(req.url).searchParams.get('t')
  if (!verifyPlaybackTicket(ticket, topicId, userId)) {
    return NextResponse.json({ error: 'INVALID_TICKET' }, { status: 403 })
  }

  const access = await assertTopicAccess(topicId, userId)
  if (!access.ok) {
    return NextResponse.json(
      { error: access.reason },
      { status: access.reason === 'NOT_FOUND' ? 404 : 403 },
    )
  }

  const url = access.topic.videoUrl
  if (!url) return NextResponse.json({ error: 'NOT_PRODUCED' }, { status: 404 })

  // 302 rather than proxying the bytes: the CDN keeps serving the media, and
  // this route stays a cheap authorisation hop.
  return NextResponse.redirect(upstreamUrl(url), {
    status: 302,
    headers: { 'cache-control': 'private, no-store' },
  })
}
