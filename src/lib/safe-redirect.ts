/**
 * Where a form may send the browser after it succeeds.
 *
 * `?next=` is attacker-supplied — it arrives on links people are sent — so only
 * same-site, absolute-path destinations are honoured. A full URL, or a
 * protocol-relative `//evil.com` (which browsers read as "https://evil.com",
 * not as a path), would turn the sign-in form into an open redirect: a
 * convincing PaperPath login page that hands the student straight to somebody
 * else's site afterwards.
 *
 * Deliberately not in the 'use server' file that uses it — Next only allows
 * async exports there, so a synchronous helper cannot live alongside the
 * actions, and a rule this easy to get wrong should be somewhere it can be
 * tested directly.
 */
export const DEFAULT_DESTINATION = '/academic'

/**
 * A newline or a NUL can truncate the value somewhere between this check and
 * whatever finally reads it, so the string that was approved is not the string
 * that gets used. Written as a scan rather than a regex literal because the
 * range is unprintable, and an unprintable character in source is one nobody
 * reviewing this file can see.
 */
function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

export function safeNext(raw: unknown, fallback: string = DEFAULT_DESTINATION): string {
  const next = typeof raw === 'string' ? raw : String(raw ?? '')

  // Must be a path on this site.
  if (!next.startsWith('/')) return fallback
  // `//host` and `/\host` are both read as protocol-relative by browsers.
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback
  if (hasControlCharacter(next)) return fallback

  return next
}
