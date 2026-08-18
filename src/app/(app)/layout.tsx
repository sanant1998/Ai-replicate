import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Sidebar, type SidebarUser } from '@/components/Sidebar'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/session'
import { effectiveCreditCap, ensureDailyCredits } from '@/lib/credits'
import { getEntitlements } from '@/lib/access'

/**
 * Where a test account is allowed to be.
 *
 * The point of a test account is that it can only do the one thing it was made
 * to test. Hiding the other links makes that true of the navigation; this makes
 * it true of the URL bar as well, which is the half that matters when someone
 * hands the login out and a stray click lands on /pricing.
 *
 * The API routes enforce it themselves — /api/tutor refuses a test account, and
 * /api/guided is the only one it is meant to reach — because a layout guard
 * governs pages and nothing else.
 */
const TESTER_PATHS = ['/guided']

function testerMayVisit(pathname: string) {
  return TESTER_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await currentUser()

  let sidebarUser: SidebarUser | null = null
  if (user) {
    if (user.testMode) {
      const pathname = (await headers()).get('x-pathname') ?? ''
      if (pathname && !testerMayVisit(pathname)) redirect('/guided')
    }

    const [fresh, ent, childCount] = await Promise.all([
      ensureDailyCredits(user.id),
      getEntitlements(user.id),
      prisma.parentLink.count({ where: { parentId: user.id } }),
    ])
    sidebarUser = {
      name: user.name,
      dailyCredits: fresh.dailyCredits,
      // The cap actually in force today — an unconfirmed address gets less.
      dailyCreditCap: effectiveCreditCap(fresh),
      boardCode: user.board?.code ?? null,
      classLabel: user.classLevel?.label ?? null,
      language: user.language,
      isPremium: ent.classLevelIds.size > 0 || ent.courseIds.size > 0,
      isAdmin: user.role === 'ADMIN',
      isStaff: user.role === 'ADMIN' || user.role === 'TEACHER',
      // Driven by an actual link rather than by the PARENT role: an adult whose
      // child has since deleted their account should not be shown a Family page
      // with nothing in it.
      isParent: childCount > 0,
      testMode: user.testMode,
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px]">
      <Sidebar user={sidebarUser} />
      <main className="min-w-0 flex-1 px-4 py-6 lg:pr-8">{children}</main>
    </div>
  )
}
