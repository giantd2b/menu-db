import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const [transactions, categories, rules] = await Promise.all([
    prisma.transaction.count(),
    prisma.category.count(),
    prisma.categoryRule.count(),
  ])

  return NextResponse.json({
    transactions,
    categories,
    rules,
  })
}
