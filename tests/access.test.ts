import './env.ts'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
// lib/access.ts builds a Prisma client at module load. Nothing here opens a
// connection — canAccessChapter is pure — but ./env.ts has to have run first.
import { canAccessChapter } from '../src/lib/access.ts'

const nothing = { classLevelIds: new Set<string>(), courseIds: new Set<string>() }
const bundleFor = (id: string) => ({ classLevelIds: new Set([id]), courseIds: new Set<string>() })
const courseFor = (id: string) => ({ classLevelIds: new Set<string>(), courseIds: new Set([id]) })

const free = { isFree: true, courseId: 'course_maths_8' }
const locked = { isFree: false, courseId: 'course_maths_8' }
const inClass8 = { classLevelId: 'class_8' }

describe('canAccessChapter', () => {
  it('lets anyone watch chapter 1, signed in or not', () => {
    assert.equal(canAccessChapter(free, inClass8, nothing), true)
  })

  it('locks later chapters for an account with nothing', () => {
    assert.equal(canAccessChapter(locked, inClass8, nothing), false)
  })

  it('a class bundle unlocks every course in that class', () => {
    assert.equal(canAccessChapter(locked, inClass8, bundleFor('class_8')), true)
  })

  it('a class bundle unlocks nothing in another class', () => {
    assert.equal(canAccessChapter(locked, inClass8, bundleFor('class_9')), false)
  })

  it('a single-course subscription unlocks that course only', () => {
    assert.equal(canAccessChapter(locked, inClass8, courseFor('course_maths_8')), true)
    assert.equal(canAccessChapter(locked, inClass8, courseFor('course_science_8')), false)
  })

  it('does not confuse a course id with a class id', () => {
    // The two sets are separate on purpose: ids are cuids, and one collection
    // matching the other's id must never be enough.
    assert.equal(canAccessChapter(locked, inClass8, courseFor('class_8')), false)
    assert.equal(canAccessChapter(locked, inClass8, bundleFor('course_maths_8')), false)
  })
})
