import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DEFAULT_DESTINATION, safeNext } from '../src/lib/safe-redirect.ts'

const NEWLINE = String.fromCharCode(10)
const NUL = String.fromCharCode(0)

describe('safeNext', () => {
  it('keeps a same-site path', () => {
    assert.equal(safeNext('/quiz/abc'), '/quiz/abc')
    assert.equal(safeNext('/tutor?mode=career'), '/tutor?mode=career')
  })

  it('refuses an absolute URL', () => {
    assert.equal(safeNext('https://evil.example/steal'), DEFAULT_DESTINATION)
    assert.equal(safeNext('http://evil.example'), DEFAULT_DESTINATION)
  })

  it('refuses a protocol-relative destination', () => {
    // The bug this exists for: browsers read `//host` as a full URL, so a
    // string that passes "starts with /" is still off-site.
    assert.equal(safeNext('//evil.example/steal'), DEFAULT_DESTINATION)
    assert.equal(safeNext('/\\evil.example'), DEFAULT_DESTINATION)
  })

  it('refuses a value carrying a control character', () => {
    assert.equal(
      safeNext(`/academic${NEWLINE}Location: https://evil.example`),
      DEFAULT_DESTINATION,
    )
    assert.equal(safeNext(`/academic${NUL}/../admin`), DEFAULT_DESTINATION)
  })

  it('falls back for anything that is not a string', () => {
    assert.equal(safeNext(null), DEFAULT_DESTINATION)
    assert.equal(safeNext(undefined), DEFAULT_DESTINATION)
    assert.equal(safeNext(42), DEFAULT_DESTINATION)
  })

  it('honours a caller-supplied fallback', () => {
    assert.equal(safeNext('https://evil.example', '/profile'), '/profile')
  })
})
