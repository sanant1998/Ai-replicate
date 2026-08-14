import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { currentUser } from '@/lib/session'
import { AuthForm } from './AuthForm'

export default async function LoginPage(props: PageProps<'/login'>) {
  // currentUser(), not readSession(): a cookie whose user has since been deleted
  // is still a valid JWT, and bouncing on that alone locks the visitor out of
  // the only page that could give them a working session.
  if (await currentUser()) redirect('/academic')
  const sp = await props.searchParams
  const mode = sp.mode === 'signup' ? 'signup' : 'login'

  // Only the signup form needs the catalog of boards and classes.
  const boards =
    mode === 'signup'
      ? await prisma.board.findMany({
          // A board with no classes would render an empty class dropdown and
          // then fail validation, with nothing the visitor could do about it.
          where: { classes: { some: {} } },
          orderBy: { code: 'asc' },
          include: { classes: { orderBy: { sortKey: 'asc' }, select: { id: true, label: true } } },
        })
      : []

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-3xl font-extrabold tracking-tight text-navy-deep">
          paper<span className="text-ember">Path</span>
        </p>
        <AuthForm
          mode={mode}
          next={typeof sp.next === 'string' ? sp.next : undefined}
          boards={boards.map((b) => ({ id: b.id, code: b.code, name: b.name, classes: b.classes }))}
        />
      </div>
    </div>
  )
}
