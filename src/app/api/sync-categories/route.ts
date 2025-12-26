import { syncCategoriesFromExcel } from '@/lib/actions/sync-categories'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/sync-categories - Get all categories
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ categories: [] })
  }
}

// POST /api/sync-categories - Sync categories from Excel
export async function POST() {
  const result = await syncCategoriesFromExcel()
  return NextResponse.json(result)
}
