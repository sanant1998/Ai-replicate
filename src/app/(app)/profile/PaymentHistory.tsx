'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { requestRefund, type RefundState } from './refund-actions'

export type PaymentRow = {
  id: string
  plan: string
  amount: string
  paidOn: string
  status: string
  refundable: boolean
  /** Null when nothing has been asked for this payment. */
  refund: { status: string; note: string | null } | null
}

const REFUND_LABEL: Record<string, string> = {
  REQUESTED: 'Refund requested — we are looking at it',
  SENT: 'Refund approved and sent to your bank',
  APPROVED: 'Refunded',
  DECLINED: 'Refund declined',
}

/**
 * Every payment, with its receipt, and the refund the terms promise.
 *
 * The profile page listed subscriptions and nothing else, so a student had no
 * record of what they had paid, no document to show a parent, and no way to
 * claim the seven-day refund /terms offers them.
 */
export function PaymentHistory({ payments }: { payments: PaymentRow[] }) {
  if (payments.length === 0) return null

  return (
    <div className="rounded-3xl card-surface divide-y divide-navy/8">
      <p className="px-6 py-3 text-sm font-extrabold tracking-wider text-navy/45">PAYMENTS</p>
      {payments.map((p) => (
        <PaymentEntry key={p.id} payment={p} />
      ))}
    </div>
  )
}

function PaymentEntry({ payment }: { payment: PaymentRow }) {
  const [state, action, pending] = useActionState<RefundState, FormData>(requestRefund, {})
  const [open, setOpen] = useState(false)

  return (
    <div className="px-6 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-bold text-navy-deep">{payment.plan}</span>
        <span className="text-sm font-semibold text-navy/50">
          {payment.amount} · {payment.paidOn}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Link
          href={`/receipt/${payment.id}`}
          className="text-sm font-extrabold text-ember hover:underline"
        >
          View receipt
        </Link>

        {payment.refund ? (
          <span className="text-sm font-semibold text-navy/55">
            {REFUND_LABEL[payment.refund.status] ?? payment.refund.status}
            {payment.refund.note ? ` — ${payment.refund.note}` : ''}
          </span>
        ) : payment.refundable ? (
          !open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-sm font-extrabold text-navy/55 hover:text-ember"
            >
              Ask for a refund
            </button>
          )
        ) : (
          <span className="text-sm font-semibold text-navy/40">
            {payment.status === 'REFUNDED' ? 'Refunded' : 'Past the 7-day refund window'}
          </span>
        )}
      </div>

      {open && !payment.refund && (
        <form action={action} className="mt-3 space-y-2">
          <input type="hidden" name="paymentId" value={payment.id} />
          <label className="block">
            <span className="text-sm font-bold text-navy/60">
              What went wrong? We read every one of these.
            </span>
            <textarea
              name="reason"
              rows={3}
              required
              minLength={5}
              maxLength={1000}
              className="mt-1 w-full rounded-xl border border-navy/15 bg-surface px-3 py-2 font-semibold text-navy-deep outline-none transition focus:border-amber"
            />
          </label>
          {state.error && (
            <p role="alert" className="text-sm font-bold text-ember">
              {state.error}
            </p>
          )}
          {state.saved && <p className="text-sm font-bold text-moss">{state.saved}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="min-h-10 rounded-xl border border-navy/15 bg-surface px-4 font-extrabold text-navy/65 transition hover:border-amber disabled:opacity-50"
            >
              {pending ? 'Sending…' : 'Send request'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-10 rounded-xl px-4 font-extrabold text-navy/45"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
