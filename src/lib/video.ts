import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Playback tickets.
 *
 * The player never receives a lesson's real manifest URL. It receives a ticket
 * — {topicId, userId, expiry} signed with AUTH_SECRET — and plays through
 * /api/video/[topicId], which verifies the ticket and only then resolves the
 * upstream URL. A copied ticket stops working after TTL_SEC and is bound to the
 * account it was issued to, so a shared link buys nothing.
 *
 * This protects the URL. It does not stop a determined viewer from recording
 * the stream — that needs DRM, which is a CDN-level decision. What it does stop
 * is the cheap attack: one paying account pasting a manifest into a group chat.
 */
const TTL_SEC = 60 * 60 * 4

function secret() {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set')
  return s
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function issuePlaybackTicket(topicId: string, userId: string | null) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC
  const payload = `${topicId}.${userId ?? 'anon'}.${exp}`
  return `${exp}.${userId ?? 'anon'}.${sign(payload)}`
}

export function verifyPlaybackTicket(
  ticket: string | null,
  topicId: string,
  userId: string | null,
): boolean {
  if (!ticket) return false

  const parts = ticket.split('.')
  if (parts.length !== 3) return false
  const [expRaw, subject, mac] = parts as [string, string, string]

  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false

  // A ticket issued to one account must not play for another.
  if (subject !== (userId ?? 'anon')) return false

  const expected = sign(`${topicId}.${subject}.${exp}`)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Rewrites the stored URL into whatever your CDN expects. Left as identity so
 * the demo stream keeps working; replace the body with your provider's signing
 * (CloudFront signed URLs, Mux signed playback ids, Bunny token auth…) and the
 * rest of the pipeline is unchanged.
 */
export function upstreamUrl(storedUrl: string): string {
  return storedUrl
}
