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
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DIRECT_DATABASE_URL
      ? env('DIRECT_DATABASE_URL')
      : env('DATABASE_URL'),
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
})
