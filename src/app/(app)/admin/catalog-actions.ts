'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireStaff } from '@/lib/admin'
import type { AdminState } from './actions'

/**
 * Catalog structure, which the panel previously could not touch at all: before
 * this, classes, subjects and courses existed only in prisma/seed.ts, and
 * seeding wipes every table first — so adding one class meant destroying every
 * account, purchase and bit of progress.
 *
 * Classes and subjects stay ADMIN-only because they are shared by everyone.
 * Courses are the unit a teacher owns, so TEACHER may manage those.
 */
function guard(gate: () => Promise<unknown>) {
  return async function run<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
    try {
      await gate()
      return await fn()
    } catch (err) {
      if (err instanceof Error && err.message === 'FORBIDDEN') {
        return { error: 'You do not have permission to do that.' }
      }
      if (err instanceof Error && err.message.includes('Unique constraint')) {
        return { error: 'Something with that name already exists.' }
      }
      console.error('[admin/catalog]', err)
      return { error: 'That did not work. Please try again.' }
    }
  }
}

const asAdmin = guard(requireAdmin)
const asStaff = guard(requireStaff)

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HEX = /^#[0-9a-fA-F]{6}$/

/** Forms take rupees because that is what a human types; the schema stores paise. */
function rupeesToPaise(v: FormDataEntryValue | null): number | null {
  const text = String(v ?? '').trim()
  if (!text) return null
  const n = Number(text)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

// --------------------------------------------------------------------- classes

const ClassInput = z.object({
  boardId: z.string().min(1, 'Pick a board'),
  slug: z.string().trim().regex(SLUG, 'Use lower-case words joined by hyphens, e.g. class-11'),
  label: z.string().trim().min(2, 'Give the class a label').max(60),
  grade: z.coerce.number().int().min(1).max(12),
  stream: z.enum(['GENERAL', 'COMMERCE', 'SCIENCE']),
  sortKey: z.coerce.number().int().min(0).max(999),
})

export async function saveClassLevel(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return (await asAdmin(async () => {
    const id = String(formData.get('id') ?? '')
    const parsed = ClassInput.safeParse({
      boardId: formData.get('boardId'),
      slug: formData.get('slug'),
      label: formData.get('label'),
      grade: formData.get('grade'),
      stream: formData.get('stream') || 'GENERAL',
      sortKey: formData.get('sortKey') || 0,
    })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const data = {
      ...parsed.data,
      bundlePricePaise: rupeesToPaise(formData.get('bundlePrice')),
      bundleListPricePaise: rupeesToPaise(formData.get('bundleListPrice')),
    }

    if (id) await prisma.classLevel.update({ where: { id }, data })
    else await prisma.classLevel.create({ data })

    revalidatePath('/admin/catalog')
    revalidatePath('/admin')
    revalidatePath('/courses')
    revalidatePath('/academic')
    return { saved: true }
  })) as AdminState
}

export async function deleteClassLevel(formData: FormData) {
  await asAdmin(async () => {
    const id = String(formData.get('id') ?? '')
    // A delete cascades to courses, chapters and topics. Refuse while anything
    // depends on it rather than quietly destroying what someone paid for.
    const [courses, students] = await Promise.all([
      prisma.course.count({ where: { classLevelId: id } }),
      prisma.user.count({ where: { classLevelId: id } }),
    ])
    if (courses > 0 || students > 0) return {}
    await prisma.classLevel.delete({ where: { id } })
    revalidatePath('/admin/catalog')
    return {}
  })
}

// -------------------------------------------------------------------- subjects

const SubjectInput = z.object({
  slug: z.string().trim().regex(SLUG, 'Use lower-case words joined by hyphens, e.g. business-studies'),
  name: z.string().trim().min(2, 'Give the subject a name').max(60),
  icon: z.string().trim().min(1).max(40),
  colorFrom: z.string().trim().regex(HEX, 'Use a hex colour like #3B82F6'),
  colorTo: z.string().trim().regex(HEX, 'Use a hex colour like #2C5282'),
  sortKey: z.coerce.number().int().min(0).max(999),
})

export async function saveSubject(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return (await asAdmin(async () => {
    const id = String(formData.get('id') ?? '')
    const parsed = SubjectInput.safeParse({
      slug: formData.get('slug'),
      name: formData.get('name'),
      icon: formData.get('icon') || 'book',
      colorFrom: formData.get('colorFrom') || '#F59E0B',
      colorTo: formData.get('colorTo') || '#EA580C',
      sortKey: formData.get('sortKey') || 0,
    })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    if (id) await prisma.subject.update({ where: { id }, data: parsed.data })
    else await prisma.subject.create({ data: parsed.data })

    revalidatePath('/admin/catalog')
    revalidatePath('/admin')
    revalidatePath('/courses')
    return { saved: true }
  })) as AdminState
}

export async function deleteSubject(formData: FormData) {
  await asAdmin(async () => {
    const id = String(formData.get('id') ?? '')
    if ((await prisma.course.count({ where: { subjectId: id } })) > 0) return {}
    await prisma.subject.delete({ where: { id } })
    revalidatePath('/admin/catalog')
    return {}
  })
}

// --------------------------------------------------------------------- courses

const CourseInput = z.object({
  classLevelId: z.string().min(1, 'Pick a class'),
  subjectId: z.string().min(1, 'Pick a subject'),
  sortKey: z.coerce.number().int().min(0).max(999),
})

export async function saveCourse(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return (await asStaff(async () => {
    const id = String(formData.get('id') ?? '')
    const parsed = CourseInput.safeParse({
      classLevelId: formData.get('classLevelId'),
      subjectId: formData.get('subjectId'),
      sortKey: formData.get('sortKey') || 0,
    })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    // (classLevelId, subjectId) is unique: one course per subject per class.
    const clash = await prisma.course.findFirst({
      where: {
        classLevelId: parsed.data.classLevelId,
        subjectId: parsed.data.subjectId,
        ...(id ? { NOT: { id } } : {}),
      },
    })
    if (clash) return { error: 'That class already has a course for this subject.' }

    const data = { ...parsed.data, pricePaise: rupeesToPaise(formData.get('price')) ?? 0 }

    if (id) await prisma.course.update({ where: { id }, data })
    else await prisma.course.create({ data })

    revalidatePath('/admin')
    revalidatePath('/courses')
    revalidatePath('/academic')
    return { saved: true }
  })) as AdminState
}

export async function deleteCourse(formData: FormData) {
  await asStaff(async () => {
    const id = String(formData.get('id') ?? '')
    // Someone paid for this — deleting it would revoke access they own.
    if ((await prisma.subscription.count({ where: { courseId: id } })) > 0) return {}
    await prisma.course.delete({ where: { id } })
    revalidatePath('/admin')
    revalidatePath('/courses')
    return {}
  })
}

// ----------------------------------------------------------------------- roles

export async function setUserRole(_prev: AdminState, formData: FormData): Promise<AdminState> {
  return (await asAdmin(async () => {
    const id = String(formData.get('id') ?? '')
    const role = String(formData.get('role') ?? '')
    if (!['STUDENT', 'TEACHER', 'ADMIN'].includes(role)) return { error: 'Unknown role.' }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return { error: 'That user no longer exists.' }

    // Never let the last admin be demoted: nobody could reach role management
    // or the catalog again, and there is no way back through the UI.
    if (target.role === 'ADMIN' && role !== 'ADMIN') {
      const admins = await prisma.user.count({ where: { role: 'ADMIN' } })
      if (admins <= 1) return { error: 'This is the only admin left — promote someone else first.' }
    }

    await prisma.user.update({
      where: { id },
      data: { role: role as 'STUDENT' | 'TEACHER' | 'ADMIN' },
    })
    revalidatePath('/admin/people')
    return { saved: true }
  })) as AdminState
}
