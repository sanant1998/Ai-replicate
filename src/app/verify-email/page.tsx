import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { consumeVerificationToken } from '@/lib/verify-email'
import { ensureDailyCredits, UNVERIFIED_CREDIT_CAP } from '@/lib/credits'

export const metadata = { title: 'Confirm your email — PaperPath' }

/**
 * Confirmation lands here from the mailed link.
 *
 * The token is spent during render rather than behind a button. That makes this
 * a GET with a side effect, which is normally worth avoiding — but the
 * alternative is a page whose only content is a button the user must press to
 * finish something they already chose to do, and mail clients that prefetch
 * links would spend the token anyway. Single use and 24-hour expiry bound the
 * damage of a prefetch to "the student sees 'already confirmed'".
 */
export default async function VerifyEmailPage(props: PageProps<'/verify-email'>) {
  const sp = await props.searchParams
  const token = typeof sp.token === 'string' ? sp.token : ''

  const userId = token ? await consumeVerificationToken(token) : null

  if (userId) {
    // updateMany, not update: a second click on the same link must not throw,
    // and re-confirming an already-confirmed address is a no-op rather than a
    // way to reset the timestamp.
    //
    // creditsGrantedOn is cleared alongside it. Today's allowance was already
    // handed out at the unverified cap, and ensureDailyCredits refuses to grant
    // twice in one UTC day — so without this the page would promise a full
    // allowance the student does not actually get until tomorrow, and the
    // sidebar would sit on "2 / 5". Only reached when the row actually changed,
    // so a second click cannot re-grant.
    const { count } = await prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date(), creditsGrantedOn: null },
    })
    if (count > 0) await ensureDailyCredits(userId)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-extrabold text-navy-deep">
        {userId ? 'Email confirmed' : 'That link did not work'}
      </h1>
      <p className="font-semibold text-navy/60">
        {userId ? (
          <>
            Thanks — your address is confirmed and your full daily allowance of AI tutor questions is
            unlocked.
          </>
        ) : (
          <>
            Confirmation links last 24 hours and can only be used once. Open your profile to send a
            fresh one — until then your account works normally, with {UNVERIFIED_CREDIT_CAP} AI
            questions a day instead of your full allowance.
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/academic"
          className="min-h-11 rounded-xl bg-ember px-5 py-3 font-extrabold text-white transition hover:opacity-90"
        >
          Go to my courses
        </Link>
        {!userId && (
          <Link
            href="/profile"
            className="min-h-11 rounded-xl border border-navy/15 bg-white px-5 py-3 font-extrabold text-navy/65 transition hover:border-amber"
          >
            Send a new link
          </Link>
        )}
      </div>
    </main>
  )
}
