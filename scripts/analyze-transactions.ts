import { prisma } from '../src/lib/prisma'

async function main() {
  // Get sample transactions
  const transactions = await prisma.transaction.findMany({
    take: 30,
    orderBy: { date: 'desc' },
    select: {
      description: true,
      rawDescription: true,
      note: true,
      withdrawal: true,
      deposit: true,
      channel: true,
      transactionCode: true,
      category: { select: { name: true } }
    }
  })

  console.log('=== Sample Transactions ===')
  transactions.forEach((t, i) => {
    console.log(`[${i+1}] Desc: ${t.description}`)
    console.log(`    Raw: ${t.rawDescription}`)
    console.log(`    Note: ${t.note || '-'}`)
    console.log(`    Channel: ${t.channel || '-'}, Code: ${t.transactionCode || '-'}`)
    console.log(`    W: ${t.withdrawal}, D: ${t.deposit}`)
    console.log(`    Cat: ${t.category?.name || 'Uncategorized'}`)
    console.log('---')
  })

  // Get category distribution
  const categories = await prisma.transaction.groupBy({
    by: ['categoryId'],
    _count: true,
  })

  console.log('\n=== Category Distribution ===')
  for (const cat of categories) {
    const category = cat.categoryId ? await prisma.category.findUnique({ where: { id: cat.categoryId } }) : null
    console.log(`${category?.name || 'No Category'}: ${cat._count}`)
  }

  // Get unique descriptions for pattern analysis
  console.log('\n=== Unique Descriptions ===')
  const uniqueDescs = await prisma.transaction.findMany({
    distinct: ['description'],
    select: { description: true },
    take: 50,
  })
  uniqueDescs.forEach(d => console.log(`- ${d.description}`))

  // Get unique rawDescriptions
  console.log('\n=== Unique Raw Descriptions ===')
  const uniqueRaw = await prisma.transaction.findMany({
    distinct: ['rawDescription'],
    select: { rawDescription: true },
    take: 50,
  })
  uniqueRaw.forEach(d => console.log(`- ${d.rawDescription}`))

  // Get unique channels
  console.log('\n=== Unique Channels ===')
  const uniqueChannels = await prisma.transaction.findMany({
    distinct: ['channel'],
    select: { channel: true },
  })
  uniqueChannels.forEach(c => console.log(`- ${c.channel || 'null'}`))

  // Get unique transaction codes
  console.log('\n=== Unique Transaction Codes ===')
  const uniqueCodes = await prisma.transaction.findMany({
    distinct: ['transactionCode'],
    select: { transactionCode: true },
  })
  uniqueCodes.forEach(c => console.log(`- ${c.transactionCode || 'null'}`))
}

main().catch(console.error)
