import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'
import { formatPaise } from '@/lib/format'
import { isConfigured } from '@/lib/razorpay'
import { PlanCard } from './PlanCard'

export default async function CheckoutPage(props: PageProps<'/checkout'>) {
  const sp = await props.searchParams
  const courseId = typeof sp.course === 'string' ? sp.course : undefined
  const classSlug = typeof sp.class === 'string' ? sp.class : undefined

  const session = await readSession()

  // Readable while signed out, on purpose. Redirecting an anonymous visitor to
  // /login meant that every "See plans" link — all of which route through
  // /pricing into this page — asked them to create an account before they had
  // been shown a single price. The prices are already public on the landing
  // page and /courses; hiding them at the one place someone arrives ready to
  // buy was the odd one out. Buying still requires an account: the card's CTA
  // becomes a sign-in link, and startCheckout refuses anonymous callers.
  const self =
    '/checkout' + (courseId ? `?course=${courseId}` : classSlug ? `?class=${classSlug}` : '')
  const signInHref = session ? undefined : `/login?next=${encodeURIComponent(self)}`

  const course = courseId
    ? await prisma.course.findUnique({
        where: { id: courseId },
        include: { subject: true, classLevel: true, chapters: true },
      })
    : null

  const classLevel = classSlug
    ? await prisma.classLevel.findFirst({
        where: { slug: classSlug },
        include: { courses: { include: { subject: true } } },
      })
    : course?.classLevel
      ? await prisma.classLevel.findUnique({
          where: { id: course.classLevelId },
          include: { courses: { include: { subject: true } } },
        })
      : null

  if (!course && !classLevel) redirect('/academic')

  const bundlePrice = classLevel?.bundlePricePaise
  const saving =
    classLevel?.bundleListPricePaise && bundlePrice
      ? classLevel.bundleListPricePaise - bundlePrice
      : null

  const live = isConfigured()
  const mockOn = process.env.NODE_ENV !== 'production' && process.env.ALLOW_MOCK_CHECKOUT === '1'

  // A course left on the schema's default price would render "₹0" and then be
  // refused by startCheckout with "this plan has no price set". Don't offer it.
  const showCourse = Boolean(course && course.pricePaise > 0)
  const showBundle = Boolean(classLevel && bundlePrice)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-3xl font-extrabold text-navy-deep">Choose your plan</h1>
      <p className="-mt-3 font-semibold text-navy/50">
        Annual access. Chapter 1 of every subject stays free either way.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {course && showCourse && (
          <PlanCard
            title={`${course.subject.name} — ${course.classLevel.label}`}
            priceLabel={formatPaise(course.pricePaise)}
            features={[
              `${course.chapters.length} chapters, full year`,
              'Every video lecture in this subject',
              'AI tutor with chapter context',
            ]}
            payload={{ scope: 'COURSE', id: course.id }}
            cta="Buy this subject"
            signInHref={signInHref}
          />
        )}

        {classLevel && bundlePrice && (
          <PlanCard
            featured
            title={`Complete ${classLevel.label.replace('Class - ', 'Class ')}`}
            priceLabel={formatPaise(bundlePrice)}
            strikeLabel={
              classLevel.bundleListPricePaise ? formatPaise(classLevel.bundleListPricePaise) : undefined
            }
            features={[
              `All ${classLevel.courses.length} subjects`,
              saving ? `Save ${formatPaise(saving)} vs buying separately` : 'Full-year access',
              'Higher daily AI tutor credits',
            ]}
            payload={{ scope: 'CLASS', id: classLevel.id }}
            cta="Buy the bundle"
            signInHref={signInHref}
          />
        )}
      </div>

      {!showCourse && !showBundle && (
        <p className="rounded-2xl bg-navy/5 px-5 py-4 text-sm font-semibold text-navy/60">
          Nothing is on sale for this class yet — its prices have not been set. Chapter 1 of every
          subject is free to watch in the meantime.
        </p>
      )}

      {live ? (
        <p className="rounded-2xl bg-moss/10 px-5 py-4 text-sm font-semibold text-navy/60">
          Payments are handled by Razorpay. Your access is granted once Razorpay confirms the payment
          to our server, so it survives a closed tab or a lost connection.
        </p>
      ) : mockOn ? (
        <p className="rounded-2xl bg-amber/15 px-5 py-4 text-sm font-semibold text-navy/65">
          <strong className="font-extrabold text-navy-deep">Development mode:</strong> no Razorpay
          keys are set, and <code className="rounded bg-white px-1">ALLOW_MOCK_CHECKOUT=1</code> is
          on, so buying grants access immediately without charging anything. This path is compiled
          out of production builds.
        </p>
      ) : (
        <p className="rounded-2xl bg-ember/10 px-5 py-4 text-sm font-semibold text-ember">
          Payments are not configured on this server. Set <code>RAZORPAY_KEY_ID</code>,{' '}
          <code>RAZORPAY_KEY_SECRET</code> and <code>RAZORPAY_WEBHOOK_SECRET</code> to take payments.
        </p>
      )}

      <Link href="/academic" className="inline-block font-bold text-navy/50 hover:text-ember">
        ← Back to courses
      </Link>
    </div>
  )
}
