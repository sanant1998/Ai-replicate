import type { ReactNode } from 'react'
import clsx from 'clsx'

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <header className="rounded-3xl card-surface px-8 py-7">
        <h1 className="text-3xl font-extrabold text-navy-deep">{title}</h1>
        <p className="mt-1 text-sm font-bold text-navy/45">Last updated {updated}</p>
      </header>
      {children}
    </article>
  )
}

export function Section({
  title,
  tone = 'normal',
  children,
}: {
  title: string
  tone?: 'normal' | 'warn'
  children: ReactNode
}) {
  return (
    <section
      className={clsx(
        'rounded-3xl px-8 py-6',
        tone === 'warn' ? 'border border-amber/40 bg-amber/10' : 'card-surface',
      )}
    >
      <h2 className="text-lg font-extrabold text-navy-deep">{title}</h2>
      <div className="legal-body mt-2 space-y-3 font-semibold text-navy/65">{children}</div>
    </section>
  )
}
