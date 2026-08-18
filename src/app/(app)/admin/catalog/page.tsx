import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/admin'
import { Forbidden } from '../Forbidden'
import {
  AddBoard,
  AddClass,
  AddSubject,
  BoardForm,
  ClassForm,
  DeleteBoard,
  DeleteClass,
  DeleteSubject,
  SubjectForm,
} from '../CatalogEditors'

/**
 * Boards, classes and subjects — the structure every course hangs off. Admin
 * only, because renaming a class or deleting a subject affects every teacher
 * and every student at once.
 */
export default async function CatalogPage() {
  if (!(await isAdmin())) return <Forbidden />

  const [boards, classes, subjects] = await Promise.all([
    prisma.board.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { classes: true, users: true } } },
    }),
    prisma.classLevel.findMany({
      orderBy: { sortKey: 'asc' },
      include: {
        board: true,
        // Subscriptions are counted because a class bundle is scoped to the
        // class, not to a course under it: a class can have no courses left
        // and still have people holding a paid year of it.
        _count: { select: { courses: true, users: true, subscriptions: true } },
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
          {boards.length} boards · {classes.length} classes · {subjects.length} subjects. Courses live
          under each class on the admin home.
        </p>
      </div>

      {/* Each list below is a labelled region rather than a bare <section>. A
          section with no accessible name is invisible in a screen reader's
          landmark list, and it is equally unaddressable from a test — which is
          exactly how adding this BOARDS block broke verify:staff: that suite
          picked sections by text, and "3 classes · 6 students" in here matched
          "CLASSES" before the real classes section did. */}
      <section className="space-y-3" aria-labelledby="catalog-boards">
        <h2 id="catalog-boards" className="text-sm font-extrabold tracking-wider text-navy/45">
          BOARDS
        </h2>
        <AddBoard />
        <ul className="space-y-2">
          {boards.map((b) => {
            const blocked =
              b._count.classes > 0
                ? `${b._count.classes} classes belong to this board`
                : b._count.users > 0
                  ? `${b._count.users} students follow this board`
                  : null
            return (
              <li key={b.id} className="rounded-2xl card-surface p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-extrabold text-navy-deep">{b.code}</span>
                  <span className="text-sm font-semibold text-navy/50">{b.name}</span>
                  <span className="text-sm font-semibold text-navy/45">
                    {b._count.classes} classes · {b._count.users} students
                  </span>
                  <span className="ml-auto">
                    <DeleteBoard id={b.id} blocked={blocked} />
                  </span>
                </div>
                {/* A board with no classes is invisible to students: every
                    picker filters empty boards out, which is why the seeded
                    ICSE board never appeared anywhere. */}
                {b._count.classes === 0 && (
                  <p className="mt-2 text-sm font-semibold text-ember">
                    No classes yet — students will not see this board until it has one.
                  </p>
                )}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-bold text-navy/55">Edit</summary>
                  <div className="mt-3">
                    <BoardForm existing={{ id: b.id, code: b.code, name: b.name }} />
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="catalog-classes">
        <h2 id="catalog-classes" className="text-sm font-extrabold tracking-wider text-navy/45">
          CLASSES
        </h2>
        <AddClass boards={boardOptions} />
        <ul className="space-y-2">
          {classes.map((c) => {
            const blocked =
              c._count.courses > 0
                ? `${c._count.courses} courses still belong to this class`
                : c._count.users > 0
                  ? `${c._count.users} students are in this class`
                  : c._count.subscriptions > 0
                    ? `${c._count.subscriptions} people hold a bundle for this class`
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

      <section className="space-y-3" aria-labelledby="catalog-subjects">
        <h2 id="catalog-subjects" className="text-sm font-extrabold tracking-wider text-navy/45">
          SUBJECTS
        </h2>
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
