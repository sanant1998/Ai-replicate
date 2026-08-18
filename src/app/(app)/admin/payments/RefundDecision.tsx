'use client'

import { useActionState, useState } from 'react'
import { approveRefund, declineRefund } from '../payment-actions'
import type { AdminState } from '../actions'

const initial: AdminState = {}

/**
 * Approve and decline share one note box, because the note goes to the student
 * either way and typing it twice would be the fastest route to sending the
 * wrong one with the wrong decision.
 */
export function RefundDecision({ id, amount }: { id: string; amount: string }) {
  const [approveState, approve, approving] = useActionState(approveRefund, initial)
  const [declineState, decline, declining] = useActionState(declineRefund, initial)
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)

  const state = approveState.error ? approveState : declineState
  const busy = approving || declining

  return (
    <div className="mt-3 space-y-2">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wide text-navy/45">
          Note to the student
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Required to decline; optional to approve."
          className="mt-1 w-full rounded-xl border border-navy/15 bg-surface px-3 py-2 font-semibold text-navy-deep outline-none transition focus:border-amber"
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {confirming ? (
          <form action={approve} className="flex items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="note" value={note} />
            <span className="text-sm font-bold text-navy-deep">Send {amount} back?</span>
            <button
              type="submit"
              disabled={busy}
              className="min-h-9 rounded-xl bg-moss px-4 text-sm font-extrabold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {approving ? 'Sending…' : 'Yes, refund'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-9 rounded-xl border border-navy/15 px-4 text-sm font-extrabold text-navy/60"
            >
              Cancel
            </button>
          </form>
        ) : (
          // Two clicks, because this one is irreversible and the provider has
          // no idempotency key to save us from the first.
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className="min-h-9 rounded-xl border border-moss/40 px-4 text-sm font-extrabold text-moss transition hover:bg-moss hover:text-white disabled:opacity-50"
          >
            Approve refund
          </button>
        )}

        <form action={decline}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="note" value={note} />
          <button
            type="submit"
            disabled={busy}
            className="min-h-9 rounded-xl border border-navy/15 px-4 text-sm font-extrabold text-navy/60 transition hover:border-ember hover:text-ember disabled:opacity-50"
          >
            {declining ? 'Declining…' : 'Decline'}
          </button>
        </form>
      </div>
    </div>
  )
}
