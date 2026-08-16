import 'server-only'
import { headers } from 'next/headers'

/**
 * Fixed-window rate limiter with two backends.
 *
 * Redis (Upstash REST) when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are set, in-process memory otherwise. The memory backend is correct for a
 * single long-lived node and an honest lie anywhere else: serverless resets it
 * on every cold start, and a horizontally-scaled deploy gives each instance its
 * own counters, so the effective limit becomes `limit × instances`. Set the
 * Upstash variables before running more than one instance.
 *
 * Daily credits already cap what one account can cost. This caps burst rate,
 * which credits do not: signup is free, so an attacker can mint accounts and
 * spend everyone's credits at once unless requests-per-IP is bounded too.
 */
export type RateVerdict = { ok: boolean; retryAfterSec: number; remaining: number }

// --------------------------------------------------------------- memory store

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

function hitMemory(key: string, limit: number, windowMs: number): RateVerdict {
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

// ---------------------------------------------------------------- redis store

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

/**
 * INCR the counter, and set the window's expiry only if the key had none — NX
 * makes the first writer own the window, so two concurrent requests can't
 * extend it. PTTL comes back in the same round trip to build retry-after.
 */
async function hitRedis(
  cfg: { url: string; token: string },
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateVerdict> {
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' },
    body: JSON.stringify([
      ['INCR', key],
      ['PEXPIRE', key, String(windowMs), 'NX'],
      ['PTTL', key],
    ]),
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`Upstash responded ${res.status}`)

  const parsed = (await res.json()) as ({ result?: unknown; error?: string } | null)[]
  const count = Number(parsed[0]?.result)
  const pttl = Number(parsed[2]?.result)
  if (!Number.isFinite(count)) throw new Error('Upstash returned no counter')

  if (count > limit) {
    return {
      ok: false,
      // A negative PTTL means "no expiry recorded"; fall back to the full window.
      retryAfterSec: Math.max(1, Math.ceil((pttl > 0 ? pttl : windowMs) / 1000)),
      remaining: 0,
    }
  }
  return { ok: true, retryAfterSec: 0, remaining: limit - count }
}

let redisWarned = false

/**
 * Spends one unit against `key`. Async because the Redis backend is a network
 * call; the memory backend resolves immediately.
 */
export async function hit(key: string, limit: number, windowMs: number): Promise<RateVerdict> {
  const cfg = redisConfig()
  if (!cfg) return hitMemory(key, limit, windowMs)

  try {
    return await hitRedis(cfg, key, limit, windowMs)
  } catch (err) {
    // Fail open on infrastructure trouble. A limiter that takes the whole app
    // down when Redis blips is worse than one that briefly stops limiting —
    // but say so loudly, because the counters are no longer shared.
    if (!redisWarned) {
      redisWarned = true
      console.error('[rate-limit] Redis unavailable, falling back to memory', err)
    }
    return hitMemory(key, limit, windowMs)
  }
}

// ------------------------------------------------------------------ client ip

/**
 * The client's IP, or null when it cannot be established.
 *
 * Forwarding headers are only believed when something trustworthy sets them:
 * Vercel overwrites `x-vercel-forwarded-for` on every request, so it cannot be
 * forged, and TRUST_PROXY=1 is the operator asserting the same about their own
 * reverse proxy. Read them unconditionally and a client picks its own bucket
 * per request, which is worse than having no per-IP limit at all.
 */
function ipFrom(get: (name: string) => string | null): string | null {
  if (process.env.VERCEL) {
    const vercel = get('x-vercel-forwarded-for')
    if (vercel) return vercel.split(',')[0]!.trim()
  }
  if (process.env.TRUST_PROXY === '1') {
    const fwd = get('x-forwarded-for')
    if (fwd) return fwd.split(',')[0]!.trim()
    const real = get('x-real-ip')
    if (real) return real.trim()
  }
  return null
}

export function clientIp(req: Request): string | null {
  return ipFrom((name) => req.headers.get(name))
}

/** Same rule, for server actions — they never receive the Request. */
export async function actionIp(): Promise<string | null> {
  const h = await headers()
  return ipFrom((name) => h.get(name))
}

/**
 * How much to relax a per-IP limit when the IP is unknown.
 *
 * Without a trustworthy IP every caller shares one bucket, so the limit stops
 * being "per client" and becomes "per deployment". Applying the per-client
 * number to it locks out legitimate users almost immediately — a 5-signups-an-
 * hour rule would cap the whole site at five accounts an hour. Scaling it keeps
 * the bucket useful against a flood without punishing the sixth honest visitor.
 * The per-account and per-email limits are unaffected and stay exact.
 */
const UNKNOWN_IP_FACTOR = 40

let sharedBucketWarned = false

/**
 * Per-IP limiter that degrades safely when the IP is unknown. Prefer this over
 * calling `hit()` with an interpolated IP: it is the difference between one
 * shared bucket sized for one client, and one sized for everybody.
 */
export async function hitIp(
  prefix: string,
  ip: string | null,
  limit: number,
  windowMs: number,
): Promise<RateVerdict> {
  if (ip) return hit(`${prefix}:${ip}`, limit, windowMs)

  if (!sharedBucketWarned && process.env.NODE_ENV === 'production') {
    sharedBucketWarned = true
    console.warn(
      '[rate-limit] No trustworthy client IP — per-IP limits are app-wide. ' +
        'Set TRUST_PROXY=1 if this app sits behind a reverse proxy that overwrites x-forwarded-for.',
    )
  }
  return hit(`${prefix}:shared`, limit * UNKNOWN_IP_FACTOR, windowMs)
}
