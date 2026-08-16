'use client'

import { useActionState, useState, type ReactNode } from 'react'
import {
  deleteClassLevel,
  deleteCourse,
  deleteSubject,
  saveClassLevel,
  saveCourse,
  saveSubject,
  setUserRole,
} from './catalog-actions'
import type { AdminState } from './actions'

const initial: AdminState = {}

const field =
  'min-h-10 w-full rounded-xl border border-navy/15 bg-white px-3 font-semibold text-navy-deep outline-none transition focus:border-amber'
const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-navy/45'

function Field({ children, name }: { children: ReactNode; name: string }) {
  return (
    <label className="block">
      <span className={label}>{name}</span>
      {children}
    </label>
  )
}

function Feedback({ state }: { state: AdminState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
        {state.error}
      </p>
    )
  }
  if (state.saved) {
    return <p className="text-sm font-bold text-moss">Saved.</p>
  }
  return null
}

function Submit({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="min-h-10 rounded-xl flame-gradient px-5 text-sm font-extrabold text-white transition hover:brightness-105"
    >
      {children}
    </button>
  )
}

/** A collapsible "Add …" panel, so the page is a list first and a form second. */
function AddPanel({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-dashed border-navy/25 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-sm font-extrabold text-navy/60 transition hover:text-ember"
      >
        {open ? '− Cancel' : `+ ${title}`}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

// --------------------------------------------------------------------- classes

export type BoardOption = { id: string; code: string }

export function ClassForm({
  boards,
  existing,
}: {
  boards: BoardOption[]
  existing?: {
    id: string
    slug: string
    label: string
    grade: number
    stream: string
    sortKey: number
    bundlePricePaise: number | null
    bundleListPricePaise: number | null
    boardId: string
  }
}) {
  const [state, action] = useActionState(saveClassLevel, initial)
  return (
    <form action={action} className="space-y-3">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="Board">
          <select name="boardId" defaultValue={existing?.boardId} className={field} required>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code}
              </option>
            ))}
          </select>
        </Field>
        <Field name="Label">
          <input name="label" defaultValue={existing?.label} placeholder="Class - 11th" className={field} required />
        </Field>
        <Field name="Slug">
          <input name="slug" defaultValue={existing?.slug} placeholder="class-11" className={field} required />
        </Field>
        <Field name="Grade">
          <input name="grade" type="number" min={1} max={12} defaultValue={existing?.grade ?? 8} className={field} required />
        </Field>
        <Field name="Stream">
          <select name="stream" defaultValue={existing?.stream ?? 'GENERAL'} className={field}>
            <option value="GENERAL">General</option>
            <option value="SCIENCE">Science</option>
            <option value="COMMERCE">Commerce</option>
          </select>
        </Field>
        <Field name="Order">
          <input name="sortKey" type="number" min={0} defaultValue={existing?.sortKey ?? 0} className={field} />
        </Field>
        <Field name="Bundle price (₹)">
          <input
            name="bundlePrice"
            type="number"
            min={0}
            step="1"
            defaultValue={existing?.bundlePricePaise ? existing.bundlePricePaise / 100 : ''}
            placeholder="Leave empty if not sold as a bundle"
            className={field}
          />
        </Field>
        <Field name="Was-price (₹)">
          <input
            name="bundleListPrice"
            type="number"
            min={0}
            step="1"
            defaultValue={existing?.bundleListPricePaise ? existing.bundleListPricePaise / 100 : ''}
            className={field}
          />
        </Field>
      </div>
      <Feedback state={state} />
      <Submit>{existing ? 'Save class' : 'Create class'}</Submit>
    </form>
  )
}

export function AddClass({ boards }: { boards: BoardOption[] }) {
  return (
    <AddPanel title="New class">
      <ClassForm boards={boards} />
    </AddPanel>
  )
}

export function DeleteClass({ id, blocked }: { id: string; blocked: string | null }) {
  return (
    <form action={deleteClassLevel}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={Boolean(blocked)}
        title={blocked ?? 'Delete this class'}
        className="rounded-lg border border-navy/15 px-2.5 py-1 text-xs font-bold text-navy/50 transition enabled:hover:border-ember enabled:hover:text-ember disabled:opacity-35"
      >
        Delete
      </button>
    </form>
  )
}

// -------------------------------------------------------------------- subjects

export function SubjectForm({
  existing,
}: {
  existing?: {
    id: string
    slug: string
    name: string
    icon: string
    colorFrom: string
    colorTo: string
    sortKey: number
  }
}) {
  const [state, action] = useActionState(saveSubject, initial)
  return (
    <form action={action} className="space-y-3">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="Name">
          <input name="name" defaultValue={existing?.name} placeholder="Physics" className={field} required />
        </Field>
        <Field name="Slug">
          <input name="slug" defaultValue={existing?.slug} placeholder="physics" className={field} required />
        </Field>
        <Field name="Icon key">
          <input name="icon" defaultValue={existing?.icon ?? 'book'} className={field} />
        </Field>
        <Field name="Order">
          <input name="sortKey" type="number" min={0} defaultValue={existing?.sortKey ?? 0} className={field} />
        </Field>
        <Field name="Colour from">
          <input name="colorFrom" type="color" defaultValue={existing?.colorFrom ?? '#3B82F6'} className="h-10 w-full rounded-xl border border-navy/15 bg-white p-1" />
        </Field>
        <Field name="Colour to">
          <input name="colorTo" type="color" defaultValue={existing?.colorTo ?? '#2C5282'} className="h-10 w-full rounded-xl border border-navy/15 bg-white p-1" />
        </Field>
      </div>
      <Feedback state={state} />
      <Submit>{existing ? 'Save subject' : 'Create subject'}</Submit>
    </form>
  )
}

export function AddSubject() {
  return (
    <AddPanel title="New subject">
      <SubjectForm />
    </AddPanel>
  )
}

export function DeleteSubject({ id, blocked }: { id: string; blocked: string | null }) {
  return (
    <form action={deleteSubject}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={Boolean(blocked)}
        title={blocked ?? 'Delete this subject'}
        className="rounded-lg border border-navy/15 px-2.5 py-1 text-xs font-bold text-navy/50 transition enabled:hover:border-ember enabled:hover:text-ember disabled:opacity-35"
      >
        Delete
      </button>
    </form>
  )
}

// --------------------------------------------------------------------- courses

export type Option = { id: string; label: string }

export function CourseForm({
  classes,
  subjects,
  existing,
}: {
  classes: Option[]
  subjects: Option[]
  existing?: { id: string; classLevelId: string; subjectId: string; pricePaise: number; sortKey: number }
}) {
  const [state, action] = useActionState(saveCourse, initial)
  return (
    <form action={action} className="space-y-3">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="Class">
          <select name="classLevelId" defaultValue={existing?.classLevelId} className={field} required>
            <option value="">Pick a class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field name="Subject">
          <select name="subjectId" defaultValue={existing?.subjectId} className={field} required>
            <option value="">Pick a subject…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field name="Price (₹)">
          <input
            name="price"
            type="number"
            min={0}
            defaultValue={existing ? existing.pricePaise / 100 : 12000}
            className={field}
          />
        </Field>
        <Field name="Order">
          <input name="sortKey" type="number" min={0} defaultValue={existing?.sortKey ?? 0} className={field} />
        </Field>
      </div>
      <Feedback state={state} />
      <Submit>{existing ? 'Save course' : 'Create course'}</Submit>
    </form>
  )
}

export function AddCourse({ classes, subjects }: { classes: Option[]; subjects: Option[] }) {
  return (
    <AddPanel title="New course">
      <CourseForm classes={classes} subjects={subjects} />
    </AddPanel>
  )
}

export function DeleteCourse({ id, blocked }: { id: string; blocked: string | null }) {
  return (
    <form action={deleteCourse}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={Boolean(blocked)}
        title={blocked ?? 'Delete this course'}
        className="rounded-lg border border-navy/15 px-2.5 py-1 text-xs font-bold text-navy/50 transition enabled:hover:border-ember enabled:hover:text-ember disabled:opacity-35"
      >
        Delete
      </button>
    </form>
  )
}

// ----------------------------------------------------------------------- roles

export function RolePicker({
  id,
  role,
  disabled,
}: {
  id: string
  role: string
  disabled?: string | null
}) {
  const [state, action] = useActionState(setUserRole, initial)
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="role"
        defaultValue={role}
        disabled={Boolean(disabled)}
        title={disabled ?? undefined}
        className="min-h-9 rounded-lg border border-navy/15 bg-white px-2 text-sm font-bold text-navy-deep disabled:opacity-45"
      >
        <option value="STUDENT">Student</option>
        <option value="TEACHER">Teacher</option>
        <option value="ADMIN">Admin</option>
      </select>
      <button
        type="submit"
        disabled={Boolean(disabled)}
        className="min-h-9 rounded-lg border border-navy/15 px-3 text-xs font-extrabold text-navy/60 transition enabled:hover:border-amber disabled:opacity-45"
      >
        Set
      </button>
      {state.error && <span className="text-xs font-bold text-ember">{state.error}</span>}
      {state.saved && <span className="text-xs font-bold text-moss">Saved</span>}
    </form>
  )
}
