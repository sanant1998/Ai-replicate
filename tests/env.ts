/**
 * Environment the library modules need just to be *imported*.
 *
 * `lib/prisma.ts` builds its client at module scope and `lib/session.ts` and
 * `lib/video.ts` read `AUTH_SECRET`, so a test that imports any of them has to
 * have these in place first. Import this module before the module under test —
 * evaluation follows import order, so the side effect lands early enough.
 *
 * None of these values reach a network or a database: every test in this suite
 * exercises pure functions. Anything needing a real connection belongs in the
 * verify:* suites, which run against a real server.
 */
process.env.DATABASE_URL ??= 'postgresql://unit:test@127.0.0.1:5432/unused'
process.env.AUTH_SECRET ??= 'unit-test-secret-not-used-anywhere-else'

export {}
