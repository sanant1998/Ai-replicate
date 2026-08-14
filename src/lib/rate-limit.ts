import 'server-only'

/**
 * Fixed-window rate limiter.
 *
 * The store is per-process and in-memory, which is the right shape for a single
 * node and an honest lie on a horizontally-scaled deploy: each instance keeps
 * its own counters, so the effective limit is `limit × instances`. Swap
 * `hit()` for a Redis INCR + EXPIRE when you run more than one instance.
 *
 * Daily credits already cap what one account can cost. This caps burst rate,
 * which credits do not: signup is free, so an attacker can mint accounts and
 * spend everyone's credits at once unless requests-per-IP is bounded too.
 */
type Window = { count: number; resetAt: number }

const buckets = new Map<string, Window>()

// Keep the map from growing without bound on a long-lived process.
const SWEEP_EVERY = 5 * 60 * 1000
let lastSweep = Date.now()

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY) return
  lastSweep = now
  for (const [key, w] of buckets) if (w.resetAt <= now) buckets.delete(key)
}

export type RateVerdict = { ok: boolean; retryAfterSec: number; remaining: number }

export function hit(key: string, limit: number, windowMs: number): RateVerdict {
  const now = Date.now()
  sweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSec: 0, remaining: limit - 1 }
  }

  existing.count += 1
  if (existing.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
    }
  }
  return { ok: true, retryAfterSec: 0, remaining: limit - existing.count }
}

/**
 * Best-effort client IP. Trust the proxy headers only when the app actually
 * sits behind a proxy that sets them — otherwise a client can forge them and
 * give itself a fresh bucket per request.
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === '1') {
    const fwd = req.headers.get('x-forwarded-for')
    if (fwd) return fwd.split(',')[0]!.trim()
    const real = req.headers.get('x-real-ip')
    if (real) return real.trim()
  }
  return 'local'
}
