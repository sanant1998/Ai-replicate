import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { issuePlaybackTicket, verifyPlaybackTicket } from '../src/lib/video.ts'

// lib/video.ts reads the key at call time rather than at import time, so
// setting it here — after the hoisted imports, before any test body runs — is
// early enough.
process.env.AUTH_SECRET = 'unit-test-secret-not-used-anywhere-else'

describe('playback tickets', () => {
  it('accepts a ticket it just issued', () => {
    const ticket = issuePlaybackTicket('topic_1', 'user_1')
    assert.equal(verifyPlaybackTicket(ticket, 'topic_1', 'user_1'), true)
  })

  it('refuses a ticket issued for a different lesson', () => {
    // The whole point of binding the topic in: otherwise one free chapter's
    // ticket would play every locked lesson on the site.
    const ticket = issuePlaybackTicket('topic_1', 'user_1')
    assert.equal(verifyPlaybackTicket(ticket, 'topic_2', 'user_1'), false)
  })

  it('refuses a ticket issued to a different account', () => {
    const ticket = issuePlaybackTicket('topic_1', 'user_1')
    assert.equal(verifyPlaybackTicket(ticket, 'topic_1', 'user_2'), false)
  })

  it('refuses a signed-in ticket replayed anonymously, and the reverse', () => {
    const mine = issuePlaybackTicket('topic_1', 'user_1')
    assert.equal(verifyPlaybackTicket(mine, 'topic_1', null), false)

    const anon = issuePlaybackTicket('topic_1', null)
    assert.equal(verifyPlaybackTicket(anon, 'topic_1', 'user_1'), false)
  })

  it('issues a usable ticket for a signed-out visitor on a free chapter', () => {
    const anon = issuePlaybackTicket('topic_1', null)
    assert.equal(verifyPlaybackTicket(anon, 'topic_1', null), true)
  })

  it('refuses a ticket whose expiry has passed', () => {
    const ticket = issuePlaybackTicket('topic_1', 'user_1')
    const [, subject, mac] = ticket.split('.')
    const expired = [Math.floor(Date.now() / 1000) - 60, subject, mac].join('.')
    assert.equal(verifyPlaybackTicket(expired, 'topic_1', 'user_1'), false)
  })

  it('refuses a ticket whose expiry has been pushed out', () => {
    // The signature covers the expiry, so extending it invalidates the MAC —
    // this is what stops a copied ticket being made permanent.
    const ticket = issuePlaybackTicket('topic_1', 'user_1')
    const [exp, subject, mac] = ticket.split('.')
    const extended = [Number(exp) + 86_400, subject, mac].join('.')
    assert.equal(verifyPlaybackTicket(extended, 'topic_1', 'user_1'), false)
  })

  it('refuses malformed input rather than throwing', () => {
    assert.equal(verifyPlaybackTicket(null, 'topic_1', 'user_1'), false)
    assert.equal(verifyPlaybackTicket('', 'topic_1', 'user_1'), false)
    assert.equal(verifyPlaybackTicket('garbage', 'topic_1', 'user_1'), false)
    assert.equal(verifyPlaybackTicket('a.b', 'topic_1', 'user_1'), false)
    assert.equal(verifyPlaybackTicket('a.b.c.d', 'topic_1', 'user_1'), false)
    assert.equal(verifyPlaybackTicket('notanumber.user_1.abc', 'topic_1', 'user_1'), false)
  })

  it('refuses a forged signature of the right length', () => {
    const ticket = issuePlaybackTicket('topic_1', 'user_1')
    const [exp, subject, mac] = ticket.split('.')
    const forged = [exp, subject, 'x'.repeat(mac.length)].join('.')
    assert.equal(verifyPlaybackTicket(forged, 'topic_1', 'user_1'), false)
  })

  it('stops honouring tickets once the signing key changes', () => {
    const ticket = issuePlaybackTicket('topic_1', 'user_1')
    const original = process.env.AUTH_SECRET
    process.env.AUTH_SECRET = 'a-different-secret-entirely'
    try {
      assert.equal(verifyPlaybackTicket(ticket, 'topic_1', 'user_1'), false)
    } finally {
      process.env.AUTH_SECRET = original
    }
  })
})
