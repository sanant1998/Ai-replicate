import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/session'
import { canAccessChapter, getEntitlements } from '@/lib/access'
import { IconChevron, IconRobot } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default async function GuidedIndexPage() {
  const user = await currentUser()
  if (!user) redirect('/login?next=%2Fguided')

  // A topic with no material is not on offer: the tutor has nothing to be
  // grounded in, and this mode is only worth having while that is impossible.
  const topics = await prisma.topic.findMany({
    where: { content: { not: null } },
    orderBy: [{ chapter: { course: { sortKey: 'asc' } } }, { chapter: { index: 'asc' } }, { index: 'asc' }],
    include: {
      chapter: { include: { course: { include: { subject: true, classLevel: true } } } },
      _count: { select: { answers: true } },
    },
  })

  const ent = await getEntitlements(user.id)
  const visible = topics.filter(
    (t) =>
      // Test accounts are here to exercise this screen, not to hold a
      // subscription. Everyone else sees what they have paid for.
      t.content?.trim() &&
      (user.testMode || canAccessChapter(t.chapter, t.chapter.course, ent)),
  )

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-3xl card-surface px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl flame-gradient text-white">
            <IconRobot className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-navy-deep">Guided Practice</h1>
            <p className="text-sm font-semibold text-navy/45">
              Pick a topic. You get the exact answer, then the working one step at a time.
            </p>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-3xl card-surface px-6 py-8 text-center">
          <p className="font-extrabold text-navy-deep">No topics are ready yet</p>
          <p className="mt-1 text-sm font-semibold text-navy/45">
            A topic appears here once someone has written its material in the admin panel.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map((t) => (
            <Link
              key={t.id}
              href={`/guided/${t.id}`}
              className="flex items-center justify-between gap-3 rounded-3xl card-surface px-6 py-4 transition hover:border-amber"
            >
              <span className="min-w-0">
                <span className="block truncate font-extrabold text-navy-deep">{t.title}</span>
                <span className="block truncate text-sm font-semibold text-navy/45">
                  {t.chapter.course.subject.name} · {t.chapter.course.classLevel.label} · Ch{' '}
                  {t.chapter.index}: {t.chapter.title}
                </span>
                <span className="mt-1 inline-block rounded-full bg-navy/8 px-2.5 py-0.5 text-[11px] font-bold text-navy/55">
                  {t._count.answers > 0
                    ? `${t._count.answers} exact answer${t._count.answers === 1 ? '' : 's'} on file`
                    : 'answers written from the material'}
                </span>
              </span>
              <IconChevron className="size-5 shrink-0 text-navy/30" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
