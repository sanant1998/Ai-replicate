import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/session'
import { getEntitlements } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { formatPaise } from '@/lib/format'
import { logout } from '@/app/login/actions'
import { effectiveCreditCap } from '@/lib/credits'
import { ClassSettings } from './ClassSettings'
import { LanguageSettings } from './LanguageSettings'
import {
  AccountControls,
  GuardianControls,
  SecurityControls,
  VerifyEmailNotice,
} from './AccountControls'
import { PaymentHistory } from './PaymentHistory'
import { withinRefundWindow } from '@/lib/billing'

export const metadata = { title: 'Profile — PaperPath' }

export default async function ProfilePage() {
  const user = await currentUser()
  if (!user) redirect('/login?next=%2Fprofile')

  const ent = await getEntitlements(user.id)
  const subs = await prisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { course: { include: { subject: true } } },
  })

  const payments = await prisma.payment.findMany({
    where: { userId: user.id, status: { in: ['PAID', 'REFUNDED'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      classLevel: { select: { label: true } },
      course: { include: { subject: { select: { name: true } } } },
      refundRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  const boards = await prisma.board.findMany({
    where: { classes: { some: {} } },
    orderBy: { code: 'asc' },
    include: { classes: { orderBy: { sortKey: 'asc' }, select: { id: true, label: true } } },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl font-extrabold text-navy-deep">Profile</h1>

      {!user.emailVerifiedAt && <VerifyEmailNotice email={user.email} />}

      {/* Staff and parents are adults; the consent card is for the students the
          Act is about. */}
      {user.role === 'STUDENT' && (
        <GuardianControls
          guardianEmail={user.guardianEmail}
          consentedAt={user.guardianConsentAt?.toLocaleDateString('en-IN') ?? null}
        />
      )}

      <dl className="rounded-3xl card-surface divide-y divide-navy/8">
        <Row label="Name" value={user.name} />
        <Row label="Email" value={user.email} />
        <Row label="Board" value={user.board?.code ?? '—'} />
        <Row label="Class" value={user.classLevel?.label ?? '—'} />
        {/* The effective cap, not the column: an unconfirmed address is capped
            lower, and showing "2 / 5" would read as a bug. */}
        <Row
          label="Daily credits"
          value={`${user.dailyCredits} / ${effectiveCreditCap(user)}`}
        />
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

      <LanguageSettings current={user.language} />

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

      <PaymentHistory
        payments={payments.map((p) => {
          const latest = p.refundRequests[0] ?? null
          return {
            id: p.id,
            plan:
              p.scope === 'CLASS'
                ? `Complete ${p.classLevel?.label ?? 'class'}`
                : (p.course?.subject.name ?? 'Single subject'),
            amount: formatPaise(p.amountPaise),
            paidOn: p.createdAt.toLocaleDateString('en-IN'),
            status: p.status,
            refundable: p.status === 'PAID' && !p.refundedAt && withinRefundWindow(p.createdAt),
            refund: latest ? { status: latest.status, note: latest.decisionNote } : null,
          }
        })}
      />

      <SecurityControls name={user.name} />

      <form action={logout}>
        <button
          type="submit"
          className="rounded-2xl border border-navy/15 bg-surface px-5 py-2.5 font-bold text-navy-deep transition hover:border-ember hover:text-ember"
        >
          Sign out
        </button>
      </form>

      <AccountControls />
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
