import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readSession } from '@/lib/session'

/**
 * /pricing is a thin entry point into checkout. It resolves which class the
 * visitor is actually shopping for, in order of confidence:
 *   1. an explicit ?class= slug on the link
 *   2. the class on the signed-in user's profile
 *   3. the first class that actually has published content
 * Falling back to a hard-coded slug would sell a Class 10 student a Class 8 plan.
 */
export default async function PricingPage(props: PageProps<'/pricing'>) {
  const sp = await props.searchParams
  const requested = typeof sp.class === 'string' ? sp.class : undefined

  if (requested) redirect(`/checkout?class=${requested}`)

  const session = await readSession()
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.uid },
      include: { classLevel: true },
    })
    if (user?.classLevel) redirect(`/checkout?class=${user.classLevel.slug}`)
  }

  const withContent = await prisma.classLevel.findFirst({
    where: { courses: { some: { chapters: { some: {} } } } },
    orderBy: { sortKey: 'asc' },
  })

  redirect(withContent ? `/checkout?class=${withContent.slug}` : '/academic')
}
