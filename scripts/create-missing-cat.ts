import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  // Create missing category
  const cat = await prisma.category.upsert({
    where: { name: 'ต้นทุนการให้บริการ' },
    create: { name: 'ต้นทุนการให้บริการ', color: '#ef4444' },
    update: { color: '#ef4444' },
  })
  console.log('Created/Updated:', cat.name, cat.id)

  // Verify
  const check = await prisma.category.findUnique({
    where: { name: 'ต้นทุนการให้บริการ' }
  })
  console.log('Verified:', check?.name)

  await prisma.$disconnect()
}

main().catch(console.error)
