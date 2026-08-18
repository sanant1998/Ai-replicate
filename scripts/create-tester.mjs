// Creates (or repairs) the client's guided-practice test account.
//
// Safe to run against a live database: everything it writes is upserted, and it
// never overwrites material somebody has already put on the topic. Run it after
// a deploy that has migrated, and after any password change the client asks for.
//
//   npm run db:tester
//
// Run through tsx rather than plain node: the Prisma client and the seeder it
// shares with prisma/seed.ts are both TypeScript.
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { seedTester, TESTER_EMAIL } from '../prisma/tester.ts'

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
  }),
})

const { topic, subject, classLevel } = await seedTester(prisma)

console.log('✔ test account ready')
console.log(`  email    ${TESTER_EMAIL}`)
console.log(`  sees     ${subject.name} · ${classLevel.label} · ${topic.title}`)
console.log(`  material ${topic.content ? 'set' : 'EMPTY — paste it in Content Admin'}`)
console.log(`  admin    /admin/topic/${topic.id}`)

await prisma.$disconnect()
