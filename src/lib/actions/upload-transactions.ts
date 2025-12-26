'use server'

import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import {
  cleanTransactionRow,
  type RawTransactionRow,
  type CleanedTransaction
} from '@/lib/utils/clean-data'
import { categorizeTransactionWithAI, DEFAULT_CATEGORIES } from '@/lib/utils/categorize'
import { Prisma } from '@/generated/prisma'

/**
 * ผลลัพธ์การ upload
 */
export interface UploadResult {
  success: boolean
  message: string
  stats?: {
    totalRows: number
    validRows: number
    insertedRows: number
    updatedRows: number
    skippedRows: number
    errors: string[]
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

  return categoryMap
}

/**
 * Parse CSV content
 */
function parseCSV(content: string): Promise<RawTransactionRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawTransactionRow>(content, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data)
      },
      error: (error: Error) => {
        reject(error)
      },
    })
  })
}

/**
 * Parse XLSX content
 */
function parseXLSX(buffer: ArrayBuffer): RawTransactionRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' })

  // ใช้ sheet แรก
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]

  // แปลงเป็น JSON พร้อม header
  const jsonData = XLSX.utils.sheet_to_json<RawTransactionRow>(worksheet, {
    raw: false, // ให้แปลงค่าเป็น string ทั้งหมด
    defval: '', // ค่า default สำหรับ cell ว่าง
  })

  return jsonData
}

/**
 * ตรวจสอบ file type
 */
function getFileType(filename: string): 'csv' | 'xlsx' | 'unknown' {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.csv')) return 'csv'
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx'
  return 'unknown'
}

/**
 * Server Action สำหรับ upload และ parse CSV/XLSX file
 * @param formData - FormData ที่มี file
 * @returns ผลลัพธ์การ upload
 */
export async function uploadTransactions(formData: FormData): Promise<UploadResult> {
  try {
    const file = formData.get('file') as File | null

    if (!file) {
      return {
        success: false,
        message: 'ไม่พบไฟล์ที่อัปโหลด',
      }
    }

    // ตรวจสอบ file type
    const fileType = getFileType(file.name)
    if (fileType === 'unknown') {
      return {
        success: false,
        message: 'รองรับเฉพาะไฟล์ CSV และ XLSX เท่านั้น',
      }
    }

    // Parse ไฟล์ตาม type
    let rawRows: RawTransactionRow[]

    if (fileType === 'csv') {
      const content = await file.text()
      rawRows = await parseCSV(content)
    } else {
      // XLSX
      const buffer = await file.arrayBuffer()
      rawRows = parseXLSX(buffer)
    }

    if (rawRows.length === 0) {
      return {
        success: false,
        message: 'ไฟล์ไม่มีข้อมูล',
      }
    }

    // สร้าง default categories
    const categoryMap = await ensureDefaultCategories()

    // Clean และ process ข้อมูล
    const cleanedTransactions: CleanedTransaction[] = []
    const errors: string[] = []

    rawRows.forEach((row, index) => {
      const cleaned = cleanTransactionRow(row)
      if (cleaned) {
        cleanedTransactions.push(cleaned)
      } else {
        errors.push(`Row ${index + 2}: ข้อมูลไม่ถูกต้อง`)
      }
    })

    // บันทึกลงฐานข้อมูล
    let insertedCount = 0
    let updatedCount = 0
    let skippedCount = 0

    for (const transaction of cleanedTransactions) {
      try {
        // จัดหมวดหมู่: ใช้ chart จาก user ก่อน, ถ้าไม่มีค่อย auto-categorize ด้วย AI
        let categoryName: string
        if (transaction.chart && transaction.chart.trim() !== '') {
          // ใช้ค่า chart ที่ user ระบุมา
          categoryName = transaction.chart.trim()
        } else {
          // auto-categorize ด้วย AI (few-shot learning จากข้อมูล manual)
          categoryName = await categorizeTransactionWithAI(transaction)
        }
        const categoryId = categoryMap.get(categoryName) || categoryMap.get('ไม่ระบุ')

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

        // Upsert - ใช้ date + accountNumber + balance เป็น unique key
        const result = await prisma.transaction.upsert({
          where: {
            unique_transaction: {
              date: transaction.date,
              accountNumber: transaction.accountNumber || '',
              balance: new Prisma.Decimal(transaction.balance),
            },
          },
          update: {
            description: transaction.description,
            rawDescription: transaction.rawDescription,
            note: transaction.note,
            withdrawal: transaction.withdrawal ? new Prisma.Decimal(transaction.withdrawal) : null,
            deposit: transaction.deposit ? new Prisma.Decimal(transaction.deposit) : null,
            accountName: transaction.accountName,
            accountType: transaction.accountType,
            channel: transaction.channel,
            transactionCode: transaction.transactionCode,
            chequeNumber: transaction.chequeNumber,
            // ไม่ update category ถ้ามีอยู่แล้ว (user อาจจะแก้ไขเอง)
          },
          create: data,
        })

        // ตรวจสอบว่าเป็น insert หรือ update
        // เปรียบเทียบ createdAt และ updatedAt
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          insertedCount++
        } else {
          updatedCount++
        }
      } catch (error) {
        if (error instanceof Error) {
          // ถ้าเป็น unique constraint violation ให้ skip
          if (error.message.includes('Unique constraint')) {
            skippedCount++
          } else {
            errors.push(`Transaction error: ${error.message}`)
          }
        }
      }
    }

    return {
      success: true,
      message: `นำเข้าข้อมูลสำเร็จ`,
      stats: {
        totalRows: rawRows.length,
        validRows: cleanedTransactions.length,
        insertedRows: insertedCount,
        updatedRows: updatedCount,
        skippedRows: skippedCount,
        errors: errors.slice(0, 10), // แสดงแค่ 10 errors แรก
      },
    }
  } catch (error) {
    console.error('Upload error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล',
    }
  }
}
