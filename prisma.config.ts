import 'dotenv/config'
import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 moved the connection URL and the seed command out of schema.prisma
// and package.json into this file.
//
// Migrations and seeding deliberately use DIRECT_DATABASE_URL when it is set:
// on Neon (and any PgBouncer-style pooler) DDL through the transaction pooler is
// unreliable, while the app itself wants the pooled endpoint for connection
// reuse. With no DIRECT_DATABASE_URL — a plain local Postgres — both are the same.
// `env()` throws when the variable is absent, and this file is loaded by every
// prisma command — including `generate`, which runs from postinstall and needs
// no database at all. Resolving it eagerly turns "no DATABASE_URL in the
// install step" (Vercel, CI, a fresh clone) into a failed install. Guard the
// lookup so only the commands that genuinely need a connection — migrate,
// introspect, seed — fail without one, and they fail saying so.
const datasource = process.env.DIRECT_DATABASE_URL
  ? { url: env('DIRECT_DATABASE_URL') }
  : process.env.DATABASE_URL
    ? { url: env('DATABASE_URL') }
    : undefined

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  ...(datasource ? { datasource } : {}),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
})
