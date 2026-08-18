import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/session'
import { getEntitlements, canAccessChapter } from '@/lib/access'
import { ToolsWorkspace } from './ToolsWorkspace'

export default async function ToolsPage() {
  const user = await currentUser()

  // The tools themselves run entirely in the browser and cost nothing, but they
  // stay behind the same sign-in gate as the rest of the app shell. Redirect
  // rather than render a dead-end card, and come back here afterwards.
  if (!user) redirect('/login?next=%2Ftools')

  // The practice generator offers the chapters this student can actually reach,
  // so the dropdown never lists something the API will refuse. The API checks
  // again anyway — this is the courtesy, not the gate.
  const ent = await getEntitlements(user.id)
  const courses = user.classLevelId
    ? await prisma.course.findMany({
        where: { classLevelId: user.classLevelId },
        orderBy: { sortKey: 'asc' },
        include: {
          subject: { select: { name: true } },
          chapters: { orderBy: { index: 'asc' } },
        },
      })
    : []

  const chapters = courses.flatMap((course) =>
    course.chapters
      .filter((chapter) => canAccessChapter(chapter, course, ent))
      .map((chapter) => ({
        id: chapter.id,
        label: `${course.subject.name} · Ch ${chapter.index}: ${chapter.title}`,
      })),
  )

  return <ToolsWorkspace chapters={chapters} />
}
