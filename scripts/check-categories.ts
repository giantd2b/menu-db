import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  })

  console.log('Total categories:', categories.length)

  // Check for specific category
  const hasTontun = categories.find(c => c.name.includes('ต้นทุน'))
  console.log('Has ต้นทุน?:', !!hasTontun, hasTontun?.name)

  // List Thai categories only
  const thai = categories.filter(c => /[\u0E00-\u0E7F]/.test(c.name))
  console.log('\nThai categories:', thai.length)
  thai.slice(0, 30).forEach((c, i) => {
    console.log(`${i + 1}. ${c.name}`)
  })

  await prisma.$disconnect()
}

main()
