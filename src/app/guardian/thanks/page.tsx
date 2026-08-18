import Link from 'next/link'

export const metadata = {
  title: 'Thank you — PaperPath',
  robots: { index: false, follow: false },
}

/**
 * Where a guardian lands after consenting without asking for an account. Kept
 * separate from the consent page so a refresh cannot look like a second
 * consent, and so the "we already have an account on this address" case has
 * somewhere honest to say so.
 */
export default async function GuardianThanksPage(props: PageProps<'/guardian/thanks'>) {
  const sp = await props.searchParams
  const linkedExisting = sp.linked === 'existing'

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <div className="rounded-3xl card-surface px-7 py-8">
        <h1 className="text-2xl font-extrabold text-navy-deep">Thank you</h1>
        <p className="mt-3 font-semibold text-navy/60">
          Permission recorded. Nothing else is needed from you.
        </p>
        {linkedExisting && (
          <p className="mt-3 font-semibold text-navy/60">
            You already have a PaperPath account on that address, so we have attached your child to
            it rather than creating a second one — sign in and open{' '}
            <Link href="/family" className="font-extrabold text-ember hover:underline">
              Family
            </Link>
            .
          </p>
        )}
        <p className="mt-4 text-sm font-semibold text-navy/45">
          You can ask for a copy of your child&rsquo;s data, or ask us to delete it, at any time —
          see the{' '}
          <Link href="/privacy" className="font-extrabold text-ember hover:underline">
            privacy policy
          </Link>
          .
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-2xl border border-navy/15 bg-surface px-5 py-2.5 font-extrabold text-navy/65 transition hover:border-amber"
        >
          Go to PaperPath
        </Link>
      </div>
    </main>
  )
}
