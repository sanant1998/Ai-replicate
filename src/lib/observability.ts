import 'server-only'

/**
 * One place errors are reported from, and one seam to point at a real APM.
 *
 * Before this, every failure in the app ended at a bare `console.error`. On
 * Vercel that is a line in a log nobody is subscribed to: a webhook that has
 * been 500ing for a week, a mail provider rejecting every send, an OpenAI key
 * that expired — all of them look, from outside, exactly like a healthy
 * deployment. The app already has this problem written down for configuration
 * (lib/config.ts); this is the runtime half.
 *
 * Deliberately dependency-free. Sentry is the obvious answer and probably the
 * right one, but it is a vendor decision, an SDK on both runtimes, and a source
 * map upload step — none of which should be forced by a library file. Swapping
 * this implementation for `Sentry.captureException` is a one-function change,
 * and everything already calls through here.
 *
 * Two outputs:
 *   - a single-line JSON record on stderr, so log search can group by `scope`
 *     and `kind` instead of grepping prose;
 *   - an optional POST to ERROR_WEBHOOK_URL (a Slack incoming webhook, or
 *     anything that accepts JSON), so somebody finds out without looking.
 */
export type ErrorContext = Record<string, string | number | boolean | null | undefined>

/** How many identical reports to send per scope before going quiet. */
const WEBHOOK_BURST = 5
const WEBHOOK_WINDOW_MS = 10 * 60_000

const recent = new Map<string, { count: number; resetAt: number }>()

/**
 * A failing dependency fails on every request. Without a cap, the first
 * database outage would post a few thousand messages into a Slack channel and
 * get the integration muted — which is worse than not having it, because it
 * fails at exactly the moment it is needed.
 */
function shouldNotify(scope: string): boolean {
  const now = Date.now()
  const seen = recent.get(scope)
  if (!seen || seen.resetAt <= now) {
    recent.set(scope, { count: 1, resetAt: now + WEBHOOK_WINDOW_MS })
    return true
  }
  seen.count += 1
  return seen.count <= WEBHOOK_BURST
}

function describe(err: unknown) {
  if (err instanceof Error) {
    return { kind: err.name, message: err.message, stack: err.stack?.split('\n').slice(0, 8).join('\n') }
  }
  return { kind: 'NonError', message: String(err), stack: undefined }
}

/**
 * Reports a failure. Never throws and never rejects — a reporter that can break
 * the request it is reporting on is a liability.
 */
export function reportError(scope: string, err: unknown, context: ErrorContext = {}): void {
  const detail = describe(err)

  // One line, so a log platform can parse it. `console.error` rather than a
  // logging library for the same reason the webhook is a fetch: this has to
  // work identically on Vercel, in a container, and in `next dev`.
  console.error(
    JSON.stringify({
      level: 'error',
      scope,
      at: new Date().toISOString(),
      ...detail,
      ...context,
    }),
  )

  const url = process.env.ERROR_WEBHOOK_URL
  if (!url || !shouldNotify(scope)) return

  // Fire and forget. Awaiting would put a third-party outage on the critical
  // path of every error page.
  void fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      // `text` is what a Slack incoming webhook renders; anything else that
      // accepts JSON gets the structured fields alongside it.
      text: `[paperpath/${scope}] ${detail.kind}: ${detail.message}`,
      scope,
      kind: detail.kind,
      message: detail.message,
      context,
    }),
    cache: 'no-store',
  }).catch(() => {
    /* the reporter must not become the incident */
  })
}
