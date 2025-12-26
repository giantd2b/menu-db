'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { DEFAULT_CATEGORIES } from '@/lib/utils/categorize'
import type { TransactionPreview } from './preview-transactions'

export interface SaveResult {
  success: boolean
  message: string
  stats?: {
    insertedRows: number
    updatedRows: number
    correctionsLearned: number
  }
}

/**
 * สร้าง default categories ถ้ายังไม่มี
 */
async function ensureDefaultCategories(): Promise<Map<string, string>> {
  const categoryMap = new Map<string, string>()

  for (const cat of DEFAULT_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: {
        name: cat.name,
        description: cat.description,
        color: cat.color,
      },
    })
    categoryMap.set(cat.name, category.id)
  }

  // เพิ่ม categories ทั้งหมดที่มีใน DB
  const allCategories = await prisma.category.findMany()
  for (const cat of allCategories) {
    categoryMap.set(cat.name, cat.id)
  }

  return categoryMap
}

/**
 * บันทึก transactions หลังจาก user review
 * และเรียนรู้จากการแก้ไขของ user
 */
export async function saveReviewedTransactions(
  previews: TransactionPreview[]
): Promise<SaveResult> {
  try {
    // สร้าง category map
    const categoryMap = await ensureDefaultCategories()

    let insertedCount = 0
    let updatedCount = 0
    let correctionsCount = 0

    for (const preview of previews) {
      const { transaction, aiCategory, selectedCategory } = preview

      // ถ้า user แก้ไข category ให้บันทึกเป็น correction สำหรับ AI learning
      if (selectedCategory !== aiCategory && transaction.note) {
        await prisma.aICorrection.create({
          data: {
            note: transaction.note,
            description: transaction.rawDescription || '',
            aiCategory,
            userCategory: selectedCategory,
          },
        })
        correctionsCount++
      }

      // หา category ID
      const categoryId = categoryMap.get(selectedCategory) || categoryMap.get('ไม่ระบุ')

      // เตรียมข้อมูลสำหรับ upsert
      const data: Prisma.TransactionCreateInput = {
        date: transaction.date,
        description: transaction.description,
        rawDescription: transaction.rawDescription,
        note: transaction.note,
        withdrawal: transaction.withdrawal ? new Prisma.Decimal(transaction.withdrawal) : null,
        deposit: transaction.deposit ? new Prisma.Decimal(transaction.deposit) : null,
        balance: new Prisma.Decimal(transaction.balance),
        accountNumber: transaction.accountNumber,
        accountName: transaction.accountName,
        accountType: transaction.accountType,
        channel: transaction.channel,
        transactionCode: transaction.transactionCode,
        chequeNumber: transaction.chequeNumber,
        category: categoryId ? { connect: { id: categoryId } } : undefined,
      }

      try {
        let result

        // For null withdrawal (deposit transactions), use findFirst + create/update
        // because Prisma upsert doesn't support null in composite unique where clause
        if (!transaction.withdrawal) {
          const existing = await prisma.transaction.findFirst({
            where: {
              date: transaction.date,
              accountNumber: transaction.accountNumber || '',
              balance: new Prisma.Decimal(transaction.balance),
              withdrawal: null,
            },
          })

          if (existing) {
            result = await prisma.transaction.update({
              where: { id: existing.id },
              data: {
                description: transaction.description,
                rawDescription: transaction.rawDescription,
                note: transaction.note,
                deposit: transaction.deposit ? new Prisma.Decimal(transaction.deposit) : null,
                accountName: transaction.accountName,
                accountType: transaction.accountType,
                channel: transaction.channel,
                transactionCode: transaction.transactionCode,
                chequeNumber: transaction.chequeNumber,
                categoryId: categoryId,
              },
            })
          } else {
            result = await prisma.transaction.create({ data })
          }
        } else {
          // For withdrawal transactions, use normal upsert
          result = await prisma.transaction.upsert({
            where: {
              unique_transaction: {
                date: transaction.date,
                accountNumber: transaction.accountNumber || '',
                balance: new Prisma.Decimal(transaction.balance),
                withdrawal: new Prisma.Decimal(transaction.withdrawal),
              },
            },
            update: {
              description: transaction.description,
              rawDescription: transaction.rawDescription,
              note: transaction.note,
              withdrawal: new Prisma.Decimal(transaction.withdrawal),
              deposit: transaction.deposit ? new Prisma.Decimal(transaction.deposit) : null,
              accountName: transaction.accountName,
              accountType: transaction.accountType,
              channel: transaction.channel,
              transactionCode: transaction.transactionCode,
              chequeNumber: transaction.chequeNumber,
              categoryId: categoryId,
            },
            create: data,
          })
        }

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          insertedCount++
        } else {
          updatedCount++
        }
      } catch (error) {
        // Skip unique constraint violations
        if (error instanceof Error && !error.message.includes('Unique constraint')) {
          console.error('Save error:', error)
        }
      }
    }

    // Revalidate dashboard to show updated data
    revalidatePath('/dashboard')
    revalidatePath('/')

    return {
      success: true,
      message: `บันทึกสำเร็จ ${insertedCount + updatedCount} รายการ`,
      stats: {
        insertedRows: insertedCount,
        updatedRows: updatedCount,
        correctionsLearned: correctionsCount,
      },
    }
  } catch (error) {
    console.error('Save error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
    }
  }
}
