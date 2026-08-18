import './env.ts'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BUNDLE_CREDIT_CAP,
  FREE_CREDIT_CAP,
  UNVERIFIED_CREDIT_CAP,
  dailyTutorLimit,
  effectiveCreditCap,
} from '../src/lib/credits.ts'

const verified = new Date('2026-01-01T00:00:00Z')

describe('effectiveCreditCap', () => {
  it('gives a confirmed free account its full allowance', () => {
    assert.equal(
      effectiveCreditCap({ dailyCreditCap: FREE_CREDIT_CAP, emailVerifiedAt: verified }),
      FREE_CREDIT_CAP,
    )
  })

  it('throttles an unconfirmed free account', () => {
    assert.equal(
      effectiveCreditCap({ dailyCreditCap: FREE_CREDIT_CAP, emailVerifiedAt: null }),
      UNVERIFIED_CREDIT_CAP,
    )
  })

  it('does not throttle someone who has paid', () => {
    // A raised cap only ever comes from a completed payment, and someone who
    // paid has no incentive to farm free allowances — so an unread
    // confirmation mail must not cost them what they bought.
    assert.equal(
      effectiveCreditCap({ dailyCreditCap: BUNDLE_CREDIT_CAP, emailVerifiedAt: null }),
      BUNDLE_CREDIT_CAP,
    )
  })

  it('never raises a cap that has been manually lowered', () => {
    assert.equal(effectiveCreditCap({ dailyCreditCap: 1, emailVerifiedAt: verified }), 1)
    assert.equal(effectiveCreditCap({ dailyCreditCap: 1, emailVerifiedAt: null }), 1)
  })
})

describe('dailyTutorLimit', () => {
  const withEnv = (value: string | undefined, run: () => void) => {
    const original = process.env.TUTOR_DAILY_LIMIT
    if (value === undefined) delete process.env.TUTOR_DAILY_LIMIT
    else process.env.TUTOR_DAILY_LIMIT = value
    try {
      run()
    } finally {
      if (original === undefined) delete process.env.TUTOR_DAILY_LIMIT
      else process.env.TUTOR_DAILY_LIMIT = original
    }
  }

  it('defaults to a ceiling rather than to none', () => {
    withEnv(undefined, () => assert.equal(dailyTutorLimit(), 200))
    withEnv('', () => assert.equal(dailyTutorLimit(), 200))
    withEnv('   ', () => assert.equal(dailyTutorLimit(), 200))
  })

  it('honours an explicit number', () => {
    withEnv('50', () => assert.equal(dailyTutorLimit(), 50))
    withEnv('1000', () => assert.equal(dailyTutorLimit(), 1000))
  })

  it('treats an explicit zero as "no ceiling"', () => {
    withEnv('0', () => assert.equal(dailyTutorLimit(), 0))
  })

  it('falls back to the default rather than uncapping on a typo', () => {
    // The failure mode this guards against is an unbounded invoice, so a
    // malformed value must never read as "unlimited".
    withEnv('two hundred', () => assert.equal(dailyTutorLimit(), 200))
    withEnv('-5', () => assert.equal(dailyTutorLimit(), 200))
    withEnv('NaN', () => assert.equal(dailyTutorLimit(), 200))
  })
})
