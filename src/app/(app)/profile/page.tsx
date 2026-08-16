import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/session'
import { getEntitlements } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { formatPaise } from '@/lib/format'
import { logout } from '@/app/login/actions'
import { ClassSettings } from './ClassSettings'

export default async function ProfilePage() {
  const user = await currentUser()
  if (!user) redirect('/login?next=%2Fprofile')

  const ent = await getEntitlements(user.id)
  const subs = await prisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { course: { include: { subject: true } } },
  })

  const boards = await prisma.board.findMany({
    where: { classes: { some: {} } },
    orderBy: { code: 'asc' },
    include: { classes: { orderBy: { sortKey: 'asc' }, select: { id: true, label: true } } },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl font-extrabold text-navy-deep">Profile</h1>

      <dl className="rounded-3xl card-surface divide-y divide-navy/8">
        <Row label="Name" value={user.name} />
        <Row label="Email" value={user.email} />
        <Row label="Board" value={user.board?.code ?? '—'} />
        <Row label="Class" value={user.classLevel?.label ?? '—'} />
        <Row label="Daily credits" value={`${user.dailyCredits} / ${user.dailyCreditCap}`} />
        <Row
          label="Access"
          value={ent.classLevelIds.size || ent.courseIds.size ? 'Premium' : 'Free — chapter 1 only'}
        />
      </dl>

      <ClassSettings
        boards={boards.map((b) => ({ id: b.id, code: b.code, name: b.name, classes: b.classes }))}
        currentBoardId={user.boardId ?? undefined}
        currentClassId={user.classLevelId ?? undefined}
      />

      {subs.length > 0 && (
        <div className="rounded-3xl card-surface divide-y divide-navy/8">
          <p className="px-6 py-3 text-sm font-extrabold tracking-wider text-navy/45">SUBSCRIPTIONS</p>
          {subs.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-6 py-4">
              <span className="font-bold text-navy-deep">
                {s.scope === 'CLASS' ? 'Full class bundle' : (s.course?.subject.name ?? 'Subject')}
              </span>
              <span className="text-sm font-semibold text-navy/50">
                {formatPaise(s.pricePaise)} · until {s.endsAt.toLocaleDateString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      )}

      <form action={logout}>
        <button
          type="submit"
          className="rounded-2xl border border-navy/15 bg-white px-5 py-2.5 font-bold text-navy-deep transition hover:border-ember hover:text-ember"
        >
          Sign out
        </button>
      </form>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <dt className="font-semibold text-navy/50">{label}</dt>
      <dd className="font-bold text-navy-deep">{value}</dd>
    </div>
  )
}
