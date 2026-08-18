import Link from 'next/link'
import { peekGuardianToken } from '@/lib/guardian'
import { ConsentForm } from './ConsentForm'

export const metadata = {
  title: 'Parent or guardian permission — PaperPath',
  robots: { index: false, follow: false },
}

/**
 * What the parent sees when they follow the link mailed to them.
 *
 * The token is only *peeked* at here, never spent: a mail client that prefetches
 * links — Outlook and several corporate scanners do — would otherwise consent on
 * the parent's behalf before they had read a word. Spending happens in the
 * action behind the button.
 *
 * The page leads with what is stored rather than with the request, because
 * consent to something unread is not consent.
 */
export default async function GuardianPage(props: PageProps<'/guardian'>) {
  const sp = await props.searchParams
  const token = typeof sp.token === 'string' ? sp.token : ''
  const row = token ? await peekGuardianToken(token) : null

  if (!row) {
    return (
      <Shell title="This link is no longer valid">
        <p className="font-semibold text-navy/60">
          Consent links last 14 days and can only be used once. Ask your child to send a new one from
          their profile page.
        </p>
      </Shell>
    )
  }

  const child = row.user

  if (child.guardianConsentAt) {
    return (
      <Shell title="Permission already given">
        <p className="font-semibold text-navy/60">
          Someone has already confirmed permission for {child.name}&rsquo;s account. If that was not
          you, reply to the email we sent and we will close the account.
        </p>
      </Shell>
    )
  }

  return (
    <Shell title={`${child.name} would like to use PaperPath`}>
      <p className="font-semibold text-navy/60">
        They gave this address as their parent or guardian. PaperPath is a chapter-wise video
        learning site for Indian school syllabuses
        {child.classLevel?.label ? `, and they signed up for ${child.classLevel.label}` : ''}.
      </p>

      <div className="mt-5 rounded-2xl bg-navy/4 px-5 py-4">
        <p className="text-sm font-extrabold tracking-wider text-navy/45">WHAT WE KEEP</p>
        <ul className="mt-2 space-y-1.5 text-sm font-semibold text-navy/65">
          <li>Their name, email address ({child.email}), board and class.</li>
          <li>Which lessons they have watched and how far through each one they are.</li>
          <li>Quiz attempts and scores, and any notes or bookmarks they make.</li>
          <li>Their conversations with the AI tutor, so a session can be picked up again.</li>
          <li>Payment records, if a subscription is ever bought.</li>
        </ul>
        <p className="mt-3 text-sm font-semibold text-navy/55">
          You can ask for a copy of all of it, or ask us to delete the account, at any time — see the{' '}
          <Link href="/privacy" className="font-extrabold text-ember hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </div>

      <ConsentForm token={token} guardianEmail={child.guardianEmail} />

      <p className="mt-4 text-sm font-semibold text-navy/45">
        If you do not recognise this, close this page and reply to the email — we will close the
        account.
      </p>
    </Shell>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <div className="rounded-3xl card-surface px-7 py-8">
        <p className="text-sm font-extrabold tracking-wider text-navy/45">PAPERPATH</p>
        <h1 className="mt-2 text-2xl font-extrabold text-navy-deep">{title}</h1>
        <div className="mt-3">{children}</div>
      </div>
    </main>
  )
}
