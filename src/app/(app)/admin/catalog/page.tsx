import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'
import { Forbidden } from '../Forbidden'
import {
  AddClass,
  AddSubject,
  ClassForm,
  DeleteClass,
  DeleteSubject,
  SubjectForm,
} from '../CatalogEditors'

/**
 * Classes and subjects — the structure every course hangs off. Admin only,
 * because renaming a class or deleting a subject affects every teacher and
 * every student at once.
 */
export default async function CatalogPage() {
  if (!(await isAdmin())) return <Forbidden />

  const [boards, classes, subjects] = await Promise.all([
    prisma.board.findMany({ orderBy: { code: 'asc' } }),
    prisma.classLevel.findMany({
      orderBy: { sortKey: 'asc' },
      include: {
        board: true,
        _count: { select: { courses: true, users: true } },
      },
    }),
    prisma.subject.findMany({
      orderBy: { sortKey: 'asc' },
      include: { _count: { select: { courses: true } } },
    }),
  ])

  const boardOptions = boards.map((b) => ({ id: b.id, code: b.code }))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-extrabold text-navy/50 hover:text-ember">
          ← Content admin
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold text-navy-deep">Catalog</h1>
        <p className="mt-1 font-semibold text-navy/50">
          {classes.length} classes · {subjects.length} subjects. Courses live under each class on the
          admin home.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold tracking-wider text-navy/45">CLASSES</h2>
        <AddClass boards={boardOptions} />
        <ul className="space-y-2">
          {classes.map((c) => {
            const blocked =
              c._count.courses > 0
                ? `${c._count.courses} courses still belong to this class`
                : c._count.users > 0
                  ? `${c._count.users} students are in this class`
                  : null
            return (
              <li key={c.id} className="rounded-2xl card-surface p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-extrabold text-navy-deep">{c.label}</span>
                  <span className="text-xs font-bold uppercase tracking-wide text-navy/40">
                    {c.board.code} · grade {c.grade} · {c.stream.toLowerCase()}
                  </span>
                  <span className="text-sm font-semibold text-navy/45">
                    {c._count.courses} courses · {c._count.users} students
                  </span>
                  <span className="ml-auto">
                    <DeleteClass id={c.id} blocked={blocked} />
                  </span>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-bold text-navy/55">Edit</summary>
                  <div className="mt-3">
                    <ClassForm boards={boardOptions} existing={{ ...c, boardId: c.boardId }} />
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold tracking-wider text-navy/45">SUBJECTS</h2>
        <AddSubject />
        <ul className="space-y-2">
          {subjects.map((s) => (
            <li key={s.id} className="rounded-2xl card-surface p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  aria-hidden
                  className="size-7 shrink-0 rounded-lg"
                  style={{ background: `linear-gradient(135deg, ${s.colorFrom}, ${s.colorTo})` }}
                />
                <span className="font-extrabold text-navy-deep">{s.name}</span>
                <span className="font-mono text-xs font-bold text-navy/40">{s.slug}</span>
                <span className="text-sm font-semibold text-navy/45">
                  {s._count.courses} courses
                </span>
                <span className="ml-auto">
                  <DeleteSubject
                    id={s.id}
                    blocked={s._count.courses > 0 ? `${s._count.courses} courses use this subject` : null}
                  />
                </span>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-bold text-navy/55">Edit</summary>
                <div className="mt-3">
                  <SubjectForm existing={s} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
