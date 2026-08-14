'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startCheckout, type CheckoutState } from './actions'
import { IconCheck } from '@/components/icons'

const initial: CheckoutState = {}

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void }
declare global {
  interface Window {
    Razorpay?: RazorpayCtor
  }
}

function loadCheckoutScript(): Promise<RazorpayCtor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () =>
      window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Checkout failed to load'))
    s.onerror = () => reject(new Error('Checkout failed to load'))
    document.body.appendChild(s)
  })
}

export function PlanCard({
  title,
  priceLabel,
  strikeLabel,
  features,
  payload,
  cta,
  featured,
}: {
  title: string
  priceLabel: string
  strikeLabel?: string
  features: string[]
  payload: { scope: 'COURSE' | 'CLASS'; id: string }
  cta: string
  featured?: boolean
}) {
  const [state, formAction, pending] = useActionState(startCheckout, initial)
  const [status, setStatus] = useState<string | null>(null)
  const router = useRouter()

  // The mock path redirects from the server; only a real order needs the modal.
  useEffect(() => {
    if (!state.order) return
    const order = state.order
    let cancelled = false

    void (async () => {
      try {
        const Razorpay = await loadCheckoutScript()
        if (cancelled) return

        new Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amountPaise,
          currency: 'INR',
          name: 'PaperPath',
          description: title,
          prefill: { name: order.name, email: order.email },
          theme: { color: '#EA580C' },
          handler: () => {
            // Access is granted by the webhook, not here — this only tells the
            // student what is happening while that arrives.
            setStatus('Payment received. Unlocking your access…')
            setTimeout(() => router.push('/academic?purchased=1'), 2500)
          },
          modal: {
            ondismiss: () => setStatus('Payment cancelled. Nothing was charged.'),
          },
        }).open()
      } catch {
        if (!cancelled) setStatus('Could not open the payment window. Please try again.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [state.order, title, router])

  return (
    <form
      action={formAction}
      className={
        featured
          ? 'rounded-3xl bg-gradient-to-br from-[#2b1a06] to-[#3d2408] p-6 text-white'
          : 'rounded-3xl card-surface p-6'
      }
    >
      <input type="hidden" name="scope" value={payload.scope} />
      <input type="hidden" name="id" value={payload.id} />

      <h2 className={featured ? 'text-lg font-extrabold text-amber' : 'text-lg font-extrabold text-navy-deep'}>
        {title}
      </h2>

      <p className="mt-2 flex items-baseline gap-2">
        <span className={featured ? 'text-3xl font-extrabold' : 'text-3xl font-extrabold text-navy-deep'}>
          {priceLabel}
        </span>
        {strikeLabel && (
          <span className="text-sm font-bold line-through opacity-45">{strikeLabel}</span>
        )}
        <span className="text-sm font-bold opacity-50">/yr</span>
      </p>

      <ul className="mt-4 space-y-2">
        {features.map((f) => (
          <li
            key={f}
            className={
              featured
                ? 'flex gap-2 text-sm font-semibold text-white/80'
                : 'flex gap-2 text-sm font-semibold text-navy/65'
            }
          >
            <IconCheck className="mt-0.5 size-4 shrink-0 text-moss" />
            {f}
          </li>
        ))}
      </ul>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-2xl flame-gradient px-4 py-3 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105 disabled:opacity-60"
      >
        {pending ? 'Starting…' : cta}
      </button>

      {state.error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember"
        >
          {state.error}
        </p>
      )}
      {status && (
        <p className={featured ? 'mt-3 text-sm font-semibold text-white/80' : 'mt-3 text-sm font-semibold text-navy/60'}>
          {status}
        </p>
      )}
    </form>
  )
}
