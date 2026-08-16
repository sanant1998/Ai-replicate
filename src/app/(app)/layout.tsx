import { Sidebar, type SidebarUser } from '@/components/Sidebar'
import { currentUser } from '@/lib/session'
import { ensureDailyCredits } from '@/lib/credits'
import { getEntitlements } from '@/lib/access'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await currentUser()

  let sidebarUser: SidebarUser | null = null
  if (user) {
    const fresh = await ensureDailyCredits(user.id)
    const ent = await getEntitlements(user.id)
    sidebarUser = {
      name: user.name,
      dailyCredits: fresh.dailyCredits,
      dailyCreditCap: fresh.dailyCreditCap,
      boardCode: user.board?.code ?? null,
      classLabel: user.classLevel?.label ?? null,
      language: user.language,
      isPremium: ent.classLevelIds.size > 0 || ent.courseIds.size > 0,
      isAdmin: user.role === 'ADMIN',
      isStaff: user.role === 'ADMIN' || user.role === 'TEACHER',
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px]">
      <Sidebar user={sidebarUser} />
      <main className="min-w-0 flex-1 px-4 py-6 lg:pr-8">{children}</main>
    </div>
  )
}
