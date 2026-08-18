import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/session'
import { formatPaiseExact } from '@/lib/format'
import { gstPercent, receiptNumber, seller, splitInclusiveTax } from '@/lib/billing'
import { PrintButton } from './PrintButton'

export const metadata = { title: 'Receipt — PaperPath', robots: { index: false, follow: false } }

/**
 * The document a parent asks for after paying, and the one this app had no way
 * of producing: there was a Payment row and nothing that rendered it.
 *
 * Whether it is a *tax invoice* or a plain receipt depends on SELLER_GSTIN.
 * Showing a GST breakdown without a registration behind it would be claiming to
 * have collected a tax that was never remitted, so the breakdown only appears
 * once the registration is configured. Printed rather than emailed as a PDF:
 * every browser prints, and a PDF generator is a dependency and an attack
 * surface for something the print dialogue already does.
 */
export default async function ReceiptPage(props: PageProps<'/receipt/[paymentId]'>) {
  const { paymentId } = await props.params
  const user = await currentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/receipt/${paymentId}`)}`)

  // Scoped to the signed-in account. An admin wanting someone else's receipt
  // goes through /admin/payments, which is a different question with a
  // different audit story.
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId: user.id },
    include: {
      classLevel: { select: { label: true } },
      course: { include: { subject: { select: { name: true } }, classLevel: { select: { label: true } } } },
    },
  })
  if (!payment) notFound()

  if (payment.status !== 'PAID' && payment.status !== 'REFUNDED') {
    return (
      <div className="mx-auto max-w-lg rounded-3xl card-surface px-8 py-12 text-center">
        <h1 className="text-2xl font-extrabold text-navy-deep">No receipt yet</h1>
        <p className="mt-2 font-semibold text-navy/55">
          This checkout was never completed, so there is nothing to receipt.
        </p>
        <Link href="/profile" className="mt-6 inline-block font-extrabold text-ember hover:underline">
          Back to your profile
        </Link>
      </div>
    )
  }

  const s = seller()
  const tax = s.gstin ? splitInclusiveTax(payment.amountPaise, gstPercent()) : null
  const plan =
    payment.scope === 'CLASS'
      ? `Complete ${payment.classLevel?.label ?? 'class'} — one year`
      : `${payment.course?.subject.name ?? 'Subject'}, ${payment.course?.classLevel.label ?? ''} — one year`

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/profile" className="text-sm font-extrabold text-navy/50 hover:text-ember">
          ← Profile
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-3xl card-surface px-8 py-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-navy/10 pb-5">
          <div>
            <p className="text-2xl font-extrabold text-navy-deep">{s.name}</p>
            {s.address && (
              <p className="mt-1 max-w-xs text-sm font-semibold whitespace-pre-line text-navy/55">
                {s.address}
              </p>
            )}
            {s.gstin && (
              <p className="mt-1 text-sm font-semibold text-navy/55">GSTIN {s.gstin}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-extrabold uppercase tracking-wide text-navy/45">
              {s.gstin ? 'Tax invoice' : 'Payment receipt'}
            </p>
            <p className="mt-1 font-extrabold text-navy-deep">
              {receiptNumber(payment.id, payment.createdAt)}
            </p>
            <p className="text-sm font-semibold text-navy/55">
              {payment.createdAt.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </header>

        <section className="grid gap-4 border-b border-navy/10 py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-navy/45">Billed to</p>
            <p className="mt-1 font-bold text-navy-deep">{user.name}</p>
            <p className="text-sm font-semibold text-navy/55">{user.email}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-extrabold uppercase tracking-wide text-navy/45">
              Payment reference
            </p>
            <p className="mt-1 font-mono text-sm font-bold break-all text-navy-deep">
              {payment.providerPaymentId ?? payment.providerOrderId}
            </p>
            {s.state && (
              <p className="text-sm font-semibold text-navy/55">Place of supply: {s.state}</p>
            )}
          </div>
        </section>

        <table className="w-full py-5 text-left">
          <thead>
            <tr className="text-xs font-extrabold uppercase tracking-wide text-navy/45">
              <th className="py-3">Description</th>
              <th className="py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="border-t border-navy/10 font-semibold text-navy/70">
            <tr>
              <td className="py-3">{plan}</td>
              <td className="py-3 text-right whitespace-nowrap">
                {formatPaiseExact(tax ? tax.taxablePaise : payment.amountPaise)}
              </td>
            </tr>
            {tax && (
              <tr>
                <td className="py-3">GST @ {tax.percent}%</td>
                <td className="py-3 text-right whitespace-nowrap">
                  {formatPaiseExact(tax.taxPaise)}
                </td>
              </tr>
            )}
            <tr className="border-t border-navy/10 text-navy-deep">
              <td className="py-3 font-extrabold">Total paid</td>
              <td className="py-3 text-right font-extrabold whitespace-nowrap">
                {formatPaiseExact(payment.amountPaise)}
              </td>
            </tr>
            {payment.refundedAt && (
              <tr className="text-ember">
                <td className="py-3 font-extrabold">
                  Refunded {payment.refundedAt.toLocaleDateString('en-IN')}
                </td>
                <td className="py-3 text-right font-extrabold whitespace-nowrap">
                  −{formatPaiseExact(payment.refundedPaise ?? payment.amountPaise)}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <footer className="border-t border-navy/10 pt-4 text-sm font-semibold text-navy/50">
          {tax ? (
            <p>Amounts shown are inclusive of GST. This is a computer-generated invoice.</p>
          ) : (
            <p>
              This is a payment receipt, not a tax invoice — no GST registration is configured for
              this seller.
            </p>
          )}
          <p className="mt-1">
            Paid by {payment.provider === 'razorpay' ? 'Razorpay' : payment.provider}.
          </p>
        </footer>
      </article>
    </div>
  )
}

