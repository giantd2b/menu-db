'use server'

import { prisma } from '@/lib/prisma'
import { invalidateDashboardCache } from './dashboard'

export interface SplitItem {
  categoryId: string
  amount: number
  note?: string
}

export interface TransactionWithSplits {
  id: string
  date: string
  description: string
  rawDescription: string
  note: string | null
  withdrawal: number | null
  deposit: number | null
  balance: number
  isSplit: boolean
  categoryId: string | null
  category: { id: string; name: string; color: string | null } | null
  splits: Array<{
    id: string
    categoryId: string
    category: { id: string; name: string; color: string | null }
    amount: number
    note: string | null
  }>
}

/**
 * Get a single transaction with its splits
 */
export async function getTransactionWithSplits(
  transactionId: string
): Promise<TransactionWithSplits | null> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      category: {
        select: { id: true, name: true, color: true },
      },
      splits: {
        include: {
          category: {
            select: { id: true, name: true, color: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!transaction) return null

  return {
    id: transaction.id,
    date: transaction.date.toISOString(),
    description: transaction.description,
    rawDescription: transaction.rawDescription,
    note: transaction.note,
    withdrawal: transaction.withdrawal ? Number(transaction.withdrawal) : null,
    deposit: transaction.deposit ? Number(transaction.deposit) : null,
    balance: Number(transaction.balance),
    isSplit: transaction.isSplit,
    categoryId: transaction.categoryId,
    category: transaction.category,
    splits: transaction.splits.map((s) => ({
      id: s.id,
      categoryId: s.categoryId,
      category: s.category,
      amount: Number(s.amount),
      note: s.note,
    })),
  }
}

/**
 * Split a transaction into multiple categories
 */
export async function splitTransaction(
  transactionId: string,
  splits: SplitItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate splits
    if (splits.length < 2) {
      return { success: false, error: 'ต้องมีอย่างน้อย 2 รายการ' }
    }

    // Get the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { withdrawal: true, deposit: true },
    })

    if (!transaction) {
      return { success: false, error: 'ไม่พบรายการ' }
    }

    // Calculate total amount
    const originalAmount = transaction.withdrawal
      ? Number(transaction.withdrawal)
      : transaction.deposit
        ? Number(transaction.deposit)
        : 0

    const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0)

    // Allow small floating point differences (0.01)
    if (Math.abs(splitTotal - originalAmount) > 0.01) {
      return {
        success: false,
        error: `ยอดรวม (${splitTotal.toFixed(2)}) ไม่ตรงกับยอดเดิม (${originalAmount.toFixed(2)})`,
      }
    }

    // Delete existing splits and create new ones
    await prisma.$transaction([
      // Delete existing splits
      prisma.transactionSplit.deleteMany({
        where: { transactionId },
      }),
      // Update transaction
      prisma.transaction.update({
        where: { id: transactionId },
        data: {
          isSplit: true,
          categoryId: null, // Clear main category when split
        },
      }),
      // Create new splits
      prisma.transactionSplit.createMany({
        data: splits.map((s) => ({
          transactionId,
          categoryId: s.categoryId,
          amount: s.amount,
          note: s.note || null,
        })),
      }),
    ])

    await invalidateDashboardCache()

    return { success: true }
  } catch (error) {
    console.error('Split transaction failed:', error)
    return { success: false, error: 'เกิดข้อผิดพลาด' }
  }
}

/**
 * Remove split and restore to single category
 */
export async function unsplitTransaction(
  transactionId: string,
  categoryId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction([
      // Delete all splits
      prisma.transactionSplit.deleteMany({
        where: { transactionId },
      }),
      // Update transaction
      prisma.transaction.update({
        where: { id: transactionId },
        data: {
          isSplit: false,
          categoryId: categoryId || null,
        },
      }),
    ])

    await invalidateDashboardCache()

    return { success: true }
  } catch (error) {
    console.error('Unsplit transaction failed:', error)
    return { success: false, error: 'เกิดข้อผิดพลาด' }
  }
}

/**
 * Update a single transaction
 */
export async function updateTransaction(
  transactionId: string,
  data: {
    categoryId?: string | null
    note?: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        categoryId: data.categoryId,
        note: data.note,
      },
    })

    await invalidateDashboardCache()

    return { success: true }
  } catch (error) {
    console.error('Update transaction failed:', error)
    return { success: false, error: 'เกิดข้อผิดพลาด' }
  }
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(
  transactionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction([
      // Delete splits first
      prisma.transactionSplit.deleteMany({
        where: { transactionId },
      }),
      // Delete transaction
      prisma.transaction.delete({
        where: { id: transactionId },
      }),
    ])

    await invalidateDashboardCache()

    return { success: true }
  } catch (error) {
    console.error('Delete transaction failed:', error)
    return { success: false, error: 'เกิดข้อผิดพลาด' }
  }
}
