import './env.ts'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hit, hitIp } from '../src/lib/rate-limit.ts'

// No Upstash variables in the test environment, so `hit` uses the in-process
// store — which is the backend a single-node deployment actually runs on, and
// the one whose arithmetic has never been checked.
const uniqueKey = (() => {
  let n = 0
  return (prefix: string) => `${prefix}:${(n += 1)}`
})()

describe('hit — fixed window', () => {
  it('allows exactly `limit` calls and refuses the next', async () => {
    const key = uniqueKey('test:allow')
    for (let i = 0; i < 3; i += 1) {
      const verdict = await hit(key, 3, 60_000)
      assert.equal(verdict.ok, true, `call ${i + 1} should be allowed`)
    }
    const fourth = await hit(key, 3, 60_000)
    assert.equal(fourth.ok, false)
    assert.equal(fourth.remaining, 0)
    assert.ok(fourth.retryAfterSec >= 1, 'a refusal must say when to come back')
  })

  it('counts down `remaining` as it goes', async () => {
    const key = uniqueKey('test:remaining')
    assert.equal((await hit(key, 3, 60_000)).remaining, 2)
    assert.equal((await hit(key, 3, 60_000)).remaining, 1)
    assert.equal((await hit(key, 3, 60_000)).remaining, 0)
  })

  it('keeps separate keys separate', async () => {
    const a = uniqueKey('test:separate')
    const b = uniqueKey('test:separate')
    await hit(a, 1, 60_000)
    assert.equal((await hit(a, 1, 60_000)).ok, false)
    assert.equal((await hit(b, 1, 60_000)).ok, true, 'one caller must not spend another"s budget')
  })

  it('opens a fresh window once the old one has passed', async () => {
    const key = uniqueKey('test:window')
    assert.equal((await hit(key, 1, 1)).ok, true)
    await new Promise((resolve) => setTimeout(resolve, 5))
    assert.equal((await hit(key, 1, 1)).ok, true, 'the window should have rolled over')
  })
})

describe('hitIp — unknown client', () => {
  it('shares one much larger bucket when the IP cannot be established', async () => {
    // Without a trustworthy IP every caller lands in the same bucket, so
    // applying the per-client number would cap the whole site at that number.
    // The scaled bucket is the difference between "five signups an hour, each"
    // and "five signups an hour, total".
    const prefix = uniqueKey('test:sharedip')
    const first = await hitIp(prefix, null, 1, 60_000)
    assert.equal(first.ok, true)
    const second = await hitIp(prefix, null, 1, 60_000)
    assert.equal(second.ok, true, 'the sixth honest visitor must not be locked out')
  })

  it('gives a known IP its own exact budget', async () => {
    const prefix = uniqueKey('test:knownip')
    assert.equal((await hitIp(prefix, '203.0.113.7', 1, 60_000)).ok, true)
    assert.equal((await hitIp(prefix, '203.0.113.7', 1, 60_000)).ok, false)
    assert.equal(
      (await hitIp(prefix, '203.0.113.8', 1, 60_000)).ok,
      true,
      'a different address is a different bucket',
    )
  })
})
