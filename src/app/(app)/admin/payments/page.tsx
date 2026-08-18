import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'
import { formatPaise, formatPaiseExact } from '@/lib/format'
import { Forbidden } from '../Forbidden'
import { RefundDecision } from './RefundDecision'

export const metadata = { title: 'Payments — PaperPath admin' }

/**
 * What the product has actually sold, and every refund waiting on a decision.
 *
 * Admin-only. The panel had no view of money at all: a refund could only be
 * issued in Razorpay's dashboard, and there was nowhere to see whether the
 * webhook that grants access had ever arrived for a payment — which is the
 * first thing you want when a student says they paid and cannot watch anything.
 */
const RECENT_LIMIT = 50

export default async function AdminPaymentsPage() {
  if (!(await isAdmin())) return <Forbidden />

  const [paid, refunded, pending, requests, recent] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: 'PAID' },
      _sum: { amountPaise: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: 'REFUNDED' },
      _sum: { refundedPaise: true },
      _count: true,
    }),
    prisma.payment.count({ where: { status: 'CREATED' } }),
    prisma.refundRequest.findMany({
      where: { status: { in: ['REQUESTED', 'SENT'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { name: true, email: true } },
        payment: true,
      },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
      include: {
        user: { select: { name: true, email: true } },
        classLevel: { select: { label: true } },
        course: { include: { subject: { select: { name: true } } } },
      },
    }),
  ])

  const gross = paid._sum.amountPaise ?? 0
  const returned = refunded._sum.refundedPaise ?? 0

  const planOf = (p: (typeof recent)[number]) =>
    p.scope === 'CLASS'
      ? (p.classLevel?.label ?? 'Class bundle')
      : (p.course?.subject.name ?? 'Single subject')

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-extrabold text-navy/50 hover:text-ember">
          ← Content admin
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold text-navy-deep">Payments</h1>
        <p className="mt-1 font-semibold text-navy/50">
          The last {RECENT_LIMIT} checkouts, and every refund waiting on a decision.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Collected" value={formatPaise(gross)} sub={`${paid._count} payments`} />
        <Tile label="Refunded" value={formatPaise(returned)} sub={`${refunded._count} payments`} />
        <Tile label="Net" value={formatPaise(gross - returned)} sub="collected less refunds" />
        <Tile
          label="Started, never paid"
          value={String(pending)}
          sub="tidied up nightly by the cron"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold tracking-wider text-navy/45">
          REFUND REQUESTS ({requests.length})
        </h2>
        {requests.length === 0 ? (
          <p className="rounded-3xl card-surface px-6 py-8 text-center font-semibold text-navy/45">
            Nothing waiting.
          </p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-3xl card-surface p-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-extrabold text-navy-deep">{r.user.name}</span>
                  <span className="text-sm font-semibold text-navy/50">{r.user.email}</span>
                  <span className="text-sm font-semibold text-navy/45">
                    paid {formatPaise(r.payment.amountPaise)} on{' '}
                    {r.payment.createdAt.toLocaleDateString('en-IN')}
                  </span>
                  {r.status === 'SENT' && (
                    <span className="rounded-full bg-amber/15 px-2 py-0.5 text-xs font-extrabold text-navy-deep">
                      Sent to the provider — waiting for the webhook
                    </span>
                  )}
                </div>
                <p className="mt-2 rounded-2xl bg-navy/4 px-4 py-3 font-semibold text-navy/70">
                  {r.reason}
                </p>
                {r.status === 'REQUESTED' && (
                  <RefundDecision id={r.id} amount={formatPaise(r.payment.amountPaise)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold tracking-wider text-navy/45">RECENT PAYMENTS</h2>
        <div className="overflow-x-auto rounded-3xl card-surface">
          <table className="w-full min-w-[46rem] text-left">
            <thead>
              <tr className="text-xs font-extrabold uppercase tracking-wide text-navy/45">
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/8">
              {recent.map((p) => (
                <tr key={p.id} className="font-semibold text-navy/70">
                  <td className="px-5 py-3 whitespace-nowrap">
                    {p.createdAt.toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-5 py-3">
                    <span className="block font-bold text-navy-deep">{p.user.name}</span>
                    <span className="text-sm text-navy/45">{p.user.email}</span>
                  </td>
                  <td className="px-5 py-3">{planOf(p)}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {formatPaiseExact(p.amountPaise)}
                  </td>
                  <td className="px-5 py-3">
                    <State status={p.status} granted={Boolean(p.subscriptionId)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl card-surface px-5 py-4">
      <p className="text-xs font-extrabold uppercase tracking-wide text-navy/45">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-navy-deep">{value}</p>
      <p className="text-sm font-semibold text-navy/45">{sub}</p>
    </div>
  )
}

/**
 * PAID without a subscription attached is the one combination worth calling
 * out: it means the money arrived and the grant did not, which is a student
 * sitting on a paywall having paid for it.
 */
function State({ status, granted }: { status: string; granted: boolean }) {
  if (status === 'PAID' && !granted) {
    return (
      <span className="rounded-full bg-ember/15 px-2.5 py-1 text-xs font-extrabold text-ember">
        Paid, not granted
      </span>
    )
  }
  const tone =
    status === 'PAID'
      ? 'bg-moss/15 text-moss'
      : status === 'REFUNDED'
        ? 'bg-navy/10 text-navy/60'
        : status === 'FAILED'
          ? 'bg-ember/10 text-ember'
          : 'bg-amber/15 text-navy-deep'
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${tone}`}>
      {status.toLowerCase()}
    </span>
  )
}
