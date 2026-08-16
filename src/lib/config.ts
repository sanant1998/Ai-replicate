import 'server-only'

/**
 * A startup audit of the settings that are optional in development and
 * load-bearing in production.
 *
 * AUTH_SECRET and DATABASE_URL already throw where they are read, so a missing
 * one is impossible to overlook. Everything listed here fails the other way:
 * the app boots, serves pages, and quietly does not do a thing it claims to.
 * Password-reset mail that goes to the server console, rate limits that reset
 * on every cold start, confirmation links built from a header the caller picks
 * — each of those looks exactly like a working deployment from the outside.
 *
 * The result is a log line, not an exception. Refusing to boot over a missing
 * SMTP host would take a running site down to fix a degraded feature.
 */
type Check = {
  label: string
  ok: () => boolean
  why: string
}

const CHECKS: Check[] = [
  {
    label: 'APP_ORIGIN',
    ok: () => Boolean(process.env.APP_ORIGIN),
    why: 'password-reset and email-confirmation links fall back to the Host header, which the caller controls; page metadata loses its base URL',
  },
  {
    label: 'SMTP_HOST or RESEND_API_KEY',
    ok: () => Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY),
    why: 'no mail provider — reset and confirmation links are written to the server log instead of being delivered',
  },
  {
    label: 'UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN',
    ok: () =>
      Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    why: 'rate-limit counters are per-process, so on serverless the login, signup and tutor caps are effectively unenforced',
  },
  {
    label: 'CRON_SECRET',
    ok: () => Boolean(process.env.CRON_SECRET),
    why: '/api/cron/maintenance refuses to run, so subscription status, abandoned checkouts and spent tokens are never tidied up',
  },
  {
    label: 'RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET + RAZORPAY_WEBHOOK_SECRET',
    ok: () =>
      Boolean(
        process.env.RAZORPAY_KEY_ID &&
          process.env.RAZORPAY_KEY_SECRET &&
          process.env.RAZORPAY_WEBHOOK_SECRET,
      ),
    why: 'checkout cannot sell, and a payment that somehow arrives cannot be verified',
  },
]

/** The labels of everything production wants and this process does not have. */
export function missingProductionConfig(): string[] {
  return CHECKS.filter((c) => !c.ok()).map((c) => c.label)
}

let reported = false

/** Logs the audit once per process. Safe to call on every request. */
export function reportProductionConfig(): void {
  if (reported || process.env.NODE_ENV !== 'production') return
  reported = true

  const missing = CHECKS.filter((c) => !c.ok())
  if (missing.length === 0) return

  console.warn(
    ['[config] Running in production without:', ...missing.map((c) => `  - ${c.label}: ${c.why}`)].join(
      '\n',
    ),
  )
}
