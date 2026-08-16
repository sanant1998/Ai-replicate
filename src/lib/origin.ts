import 'server-only'
import { headers } from 'next/headers'

/**
 * The origin to build absolute links with — reset links, verification links,
 * canonical URLs and the sitemap.
 *
 * APP_ORIGIN wins when set, and should be set in production: the Host header is
 * attacker-controlled, so deriving a link from it lets someone request a
 * password reset for your user and have the mail point at their own host.
 * Falling back to the request's own host keeps development working without
 * configuration.
 */
export async function appOrigin(): Promise<string> {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/+$/, '')
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  return `${proto}://${host}`
}
