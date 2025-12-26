import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const result = await prisma.categoryRule.deleteMany({})
  console.log('Deleted rules:', result.count)

  const remaining = await prisma.categoryRule.count()
  console.log('Remaining rules:', remaining)

  await prisma.$disconnect()
}

main().catch(console.error)
