import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { currentUser, } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { Forbidden } from '../Forbidden'
import { RolePicker } from '../CatalogEditors'

const ROLE_LABEL: Record<string, string> = {
  STUDENT: 'Student',
  TEACHER: 'Teacher',
  ADMIN: 'Admin',
  PARENT: 'Parent',
}

/** Role management. Admin only — this is the page that hands out access. */
export default async function PeoplePage(props: PageProps<'/admin/people'>) {
  if (!(await isAdmin())) return <Forbidden />

  const me = await currentUser()
  const sp = await props.searchParams
  const query = typeof sp.q === 'string' ? sp.q.trim() : ''

  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {},
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: { classLevel: true },
  })

  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
  const staff = users.filter((u) => u.role === 'ADMIN' || u.role === 'TEACHER')

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin" className="text-sm font-extrabold text-navy/50 hover:text-ember">
          ← Content admin
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold text-navy-deep">People</h1>
        <p className="mt-1 font-semibold text-navy/50">
          {staff.length} staff of {users.length} shown. Teachers may author courses, chapters,
          lessons and exam questions; admins may also change the catalog and these roles.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name or email…"
          aria-label="Search people"
          className="min-h-10 w-full max-w-sm rounded-xl border border-navy/15 bg-white px-3 font-semibold text-navy-deep outline-none transition focus:border-amber"
        />
        <button
          type="submit"
          className="min-h-10 rounded-xl border border-navy/15 bg-white px-4 text-sm font-extrabold text-navy/65 transition hover:border-amber"
        >
          Search
        </button>
      </form>

      <ul className="rounded-3xl card-surface divide-y divide-navy/8">
        {users.map((u) => {
          // Guard the two ways an admin can lock everyone out: demoting the
          // last admin, or demoting themselves mid-session.
          const lastAdmin = u.role === 'ADMIN' && adminCount <= 1
          const isSelf = u.id === me?.id
          const disabled = lastAdmin
            ? 'This is the only admin left'
            : isSelf
              ? 'You cannot change your own role'
              : null

          return (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
              <span className="min-w-0">
                <span className="block truncate font-bold text-navy-deep">
                  {u.name}
                  {isSelf && <span className="ml-2 text-xs font-bold text-navy/40">(you)</span>}
                </span>
                <span className="block truncate text-sm font-semibold text-navy/45">{u.email}</span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wide text-navy/40">
                {ROLE_LABEL[u.role] ?? u.role}
                {u.classLevel ? ` · ${u.classLevel.label}` : ''}
              </span>
              <span className="ml-auto">
                <RolePicker id={u.id} role={u.role} disabled={disabled} />
              </span>
            </li>
          )
        })}
        {users.length === 0 && (
          <li className="px-6 py-10 text-center font-semibold text-navy/45">Nobody matches that.</li>
        )}
      </ul>
    </div>
  )
}
