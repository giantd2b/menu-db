'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

/**
 * ล้างข้อมูล transactions ทั้งหมด
 */
export async function clearAllTransactions(): Promise<{
  success: boolean
  deleted: number
  error?: string
}> {
  try {
    const result = await prisma.transaction.deleteMany({})

    revalidatePath('/dashboard')

    return {
      success: true,
      deleted: result.count,
    }
  } catch (error) {
    console.error('Clear transactions error:', error)
    return {
      success: false,
      deleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * ล้างข้อมูลทั้งหมด (transactions + rules + categories)
 */
export async function clearAllData(): Promise<{
  success: boolean
  transactions: number
  rules: number
  categories: number
  error?: string
}> {
  try {
    // ลบ transactions ก่อน (มี foreign key กับ categories)
    const txResult = await prisma.transaction.deleteMany({})

    // ลบ rules (มี foreign key กับ categories)
    const rulesResult = await prisma.categoryRule.deleteMany({})

    // ลบ categories
    const catResult = await prisma.category.deleteMany({})

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/rules')

    return {
      success: true,
      transactions: txResult.count,
      rules: rulesResult.count,
      categories: catResult.count,
    }
  } catch (error) {
    console.error('Clear all data error:', error)
    return {
      success: false,
      transactions: 0,
      rules: 0,
      categories: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
