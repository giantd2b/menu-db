'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { DEFAULT_CATEGORIES } from '@/lib/utils/categorize'
import { invalidateDashboardCache } from './dashboard'
import type { TransactionPreview } from './preview-transactions'

export interface ValidationIssue {
  index: number
  field: string
  issue: string
  value: unknown
}

export interface SaveResult {
  success: boolean
  message: string
  stats?: {
    insertedRows: number
    updatedRows: number
    correctionsLearned: number
    skippedRows?: number
    errors?: string[]
  }
  validationIssues?: ValidationIssue[]
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
 * Validate transaction data before saving
 */
function validateTransaction(
  transaction: TransactionPreview['transaction'],
  index: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check date
  const txDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date)
  if (isNaN(txDate.getTime())) {
    issues.push({
      index,
      field: 'date',
      issue: 'วันที่ไม่ถูกต้อง',
      value: transaction.date,
    })
  }

  // Check balance (required)
  const balance = Number(transaction.balance)
  if (transaction.balance === null || transaction.balance === undefined || isNaN(balance)) {
    issues.push({
      index,
      field: 'balance',
      issue: 'ยอดคงเหลือไม่ถูกต้อง',
      value: transaction.balance,
    })
  }

  // Check that at least one of withdrawal/deposit exists
  const withdrawal = transaction.withdrawal ? Number(transaction.withdrawal) : null
  const deposit = transaction.deposit ? Number(transaction.deposit) : null

  if ((!withdrawal || withdrawal <= 0) && (!deposit || deposit <= 0)) {
    issues.push({
      index,
      field: 'amount',
      issue: 'ไม่มียอดเงินถอนหรือฝาก',
      value: { withdrawal: transaction.withdrawal, deposit: transaction.deposit },
    })
  }

  // Check for NaN in amounts
  if (transaction.withdrawal && isNaN(Number(transaction.withdrawal))) {
    issues.push({
      index,
      field: 'withdrawal',
      issue: 'ยอดเงินถอนไม่ถูกต้อง',
      value: transaction.withdrawal,
    })
  }

  if (transaction.deposit && isNaN(Number(transaction.deposit))) {
    issues.push({
      index,
      field: 'deposit',
      issue: 'ยอดเงินฝากไม่ถูกต้อง',
      value: transaction.deposit,
    })
  }

  return issues
}

/**
 * บันทึก transactions หลังจาก user review
 * และเรียนรู้จากการแก้ไขของ user
 */
export async function saveReviewedTransactions(
  previews: TransactionPreview[]
): Promise<SaveResult> {
  try {
    // Validate all transactions first
    const allValidationIssues: ValidationIssue[] = []
    const criticalIssues: ValidationIssue[] = []

    previews.forEach((preview, index) => {
      const issues = validateTransaction(preview.transaction, index)
      allValidationIssues.push(...issues)

      // Critical issues that prevent saving
      const critical = issues.filter(i => ['date', 'balance'].includes(i.field))
      criticalIssues.push(...critical)
    })

    // If there are critical issues, return early with validation errors
    if (criticalIssues.length > 0) {
      return {
        success: false,
        message: `พบข้อมูลไม่ถูกต้อง ${criticalIssues.length} รายการ`,
        validationIssues: criticalIssues,
      }
    }

    // สร้าง category map
    const categoryMap = await ensureDefaultCategories()

    let insertedCount = 0
    let updatedCount = 0
    let correctionsCount = 0
    let skippedCount = 0
    const errors: string[] = []

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

      // Convert date string back to Date if needed (serialization issue)
      const txDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date)

      // Convert withdrawal/deposit to numbers (handle serialization)
      const withdrawalNum = transaction.withdrawal ? Number(transaction.withdrawal) : null
      const depositNum = transaction.deposit ? Number(transaction.deposit) : null

      // เตรียมข้อมูลสำหรับ upsert
      const data: Prisma.TransactionCreateInput = {
        date: txDate,
        description: transaction.description,
        rawDescription: transaction.rawDescription,
        note: transaction.note,
        withdrawal: withdrawalNum ? new Prisma.Decimal(withdrawalNum) : null,
        deposit: depositNum ? new Prisma.Decimal(depositNum) : null,
        balance: new Prisma.Decimal(Number(transaction.balance)),
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

        // Use findFirst + create/update pattern for ALL transactions
        // because Prisma doesn't support nullable fields in composite unique upsert
        const existing = await prisma.transaction.findFirst({
          where: {
            date: txDate,
            accountNumber: transaction.accountNumber || '',
            balance: new Prisma.Decimal(Number(transaction.balance)),
            withdrawal: withdrawalNum ? new Prisma.Decimal(withdrawalNum) : null,
          },
        })

        if (existing) {
          result = await prisma.transaction.update({
            where: { id: existing.id },
            data: {
              description: transaction.description,
              rawDescription: transaction.rawDescription,
              note: transaction.note,
              withdrawal: withdrawalNum ? new Prisma.Decimal(withdrawalNum) : null,
              deposit: depositNum ? new Prisma.Decimal(depositNum) : null,
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

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          insertedCount++
        } else {
          updatedCount++
        }
      } catch (error) {
        skippedCount++
        const errMsg = `withdrawal=${withdrawalNum}, deposit=${depositNum}: ${error instanceof Error ? error.message : error}`
        errors.push(errMsg)
        console.error('[Save Error]', errMsg)
      }
    }

    // Revalidate dashboard to show updated data
    revalidatePath('/dashboard')
    revalidatePath('/')
    invalidateDashboardCache()

    // Non-critical warnings (amount issues)
    const warnings = allValidationIssues.filter(i => i.field === 'amount')

    return {
      success: true,
      message: `บันทึกสำเร็จ ${insertedCount + updatedCount} รายการ`,
      stats: {
        insertedRows: insertedCount,
        updatedRows: updatedCount,
        correctionsLearned: correctionsCount,
        skippedRows: skippedCount,
        errors: errors.slice(0, 10), // Return first 10 errors
      },
      validationIssues: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    console.error('Save error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
    }
  }
}
