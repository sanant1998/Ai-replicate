import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { runMaintenance } from '@/lib/maintenance'
import { reportError } from '@/lib/observability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Scheduled tidy-up. Point a cron at this once an hour:
 *
 *   Vercel — vercel.json { "crons": [{ "path": "/api/cron/maintenance", "schedule": "0 * * * *" }] }
 *   anything else — curl -H "authorization: Bearer $CRON_SECRET" https://…/api/cron/maintenance
 *
 * Fails closed. With CRON_SECRET unset the route refuses to run at all rather
 * than leaving a public endpoint that rewrites subscription and payment rows.
 */
function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = req.headers.get('authorization') ?? ''
  const offered = header.startsWith('Bearer ') ? header.slice(7) : header
  const a = Buffer.from(offered)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    return NextResponse.json({ ok: true, ...(await runMaintenance()) })
  } catch (err) {
    reportError('cron/maintenance', err)
    return NextResponse.json({ error: 'MAINTENANCE_FAILED' }, { status: 500 })
  }
}
