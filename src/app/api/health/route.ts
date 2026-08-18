import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { reportError } from '@/lib/observability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Liveness probe for uptime monitoring and container orchestration.
 *
 * The database round trip is the point: a process that is running but cannot
 * reach Postgres serves nothing but error pages, and a health check that only
 * proves Node is alive would call that healthy. Kept to `SELECT 1` so hitting
 * it every thirty seconds costs nothing.
 *
 * Deliberately says nothing about versions, hosts or configuration — this is
 * the one route with no auth on it.
 */
export async function GET() {
  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json(
      { status: 'ok', dbLatencyMs: Date.now() - startedAt },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (err) {
    reportError('health/database', err)
    return NextResponse.json(
      { status: 'degraded' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }
}
