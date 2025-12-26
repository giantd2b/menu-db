'use server'

import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  cleanTransactionRow,
  type RawTransactionRow,
  type CleanedTransaction
} from '@/lib/utils/clean-data'
import { categorizeTransaction, categorizeDepositTransaction } from '@/lib/utils/categorize'
import { categorizeWithAI } from '@/lib/services/ai-categorize'

/**
 * Transaction พร้อม AI suggestion สำหรับ review
 */
export interface TransactionPreview {
  // ข้อมูลจากไฟล์
  transaction: CleanedTransaction
  // AI categorization
  aiCategory: string
  aiConfidence: 'high' | 'medium' | 'low'
  aiReasoning: string
  // User edit (เริ่มต้น = AI suggestion)
  selectedCategory: string
}

export interface PreviewResult {
  success: boolean
  message: string
  previews?: TransactionPreview[]
  stats?: {
    totalRows: number
    validRows: number
    withdrawalRows: number
    depositRows: number
  }
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
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  const jsonData = XLSX.utils.sheet_to_json<RawTransactionRow>(worksheet, {
    raw: false,
    defval: '',
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
 * Preview transactions - Parse และ AI categorize โดยไม่ save
 * ให้ user review ก่อนบันทึก
 */
export async function previewTransactions(formData: FormData): Promise<PreviewResult> {
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
      const buffer = await file.arrayBuffer()
      rawRows = parseXLSX(buffer)
    }

    if (rawRows.length === 0) {
      return {
        success: false,
        message: 'ไฟล์ไม่มีข้อมูล',
      }
    }

    // Clean ข้อมูล
    const cleanedTransactions: CleanedTransaction[] = []

    // Debug: Log first raw row to see column names
    if (rawRows.length > 0) {
      console.log('[Preview Debug] First raw row columns:', Object.keys(rawRows[0]))
      console.log('[Preview Debug] First raw row:', rawRows[0])
    }

    rawRows.forEach((row) => {
      const cleaned = cleanTransactionRow(row)
      if (cleaned) {
        cleanedTransactions.push(cleaned)
      }
    })

    // Debug: Log withdrawal/deposit counts
    const withdrawalCount = cleanedTransactions.filter(t => t.withdrawal && t.withdrawal > 0).length
    const depositCount = cleanedTransactions.filter(t => t.deposit && t.deposit > 0).length
    console.log('[Preview Debug] Parsed transactions:', {
      total: cleanedTransactions.length,
      withdrawals: withdrawalCount,
      deposits: depositCount,
    })

    // Debug: Log first withdrawal if exists
    const firstWithdrawal = cleanedTransactions.find(t => t.withdrawal && t.withdrawal > 0)
    if (firstWithdrawal) {
      console.log('[Preview Debug] First withdrawal:', firstWithdrawal)
    }

    // แยก withdrawal vs deposit
    const withdrawals = cleanedTransactions.filter(t => t.withdrawal && t.withdrawal > 0)
    const deposits = cleanedTransactions.filter(t => t.deposit && t.deposit > 0)

    // AI categorize เฉพาะ withdrawals ที่ไม่มี chart
    const previews: TransactionPreview[] = []

    for (const transaction of cleanedTransactions) {
      let aiCategory = 'ไม่ระบุ'
      let aiConfidence: 'high' | 'medium' | 'low' = 'low'
      let aiReasoning = ''

      // ถ้ามี chart จาก user แล้ว ใช้เลย
      if (transaction.chart && transaction.chart.trim() !== '') {
        aiCategory = transaction.chart.trim()
        aiConfidence = 'high'
        aiReasoning = 'ระบุจากไฟล์ต้นฉบับ'
      }
      // ถ้าเป็น deposit ให้จัดหมวดหมู่ตามยอดเงิน
      else if (transaction.deposit && transaction.deposit > 0) {
        const depositCategory = categorizeDepositTransaction(transaction)
        if (depositCategory) {
          aiCategory = depositCategory
          aiConfidence = 'high'
          // กำหนด reasoning ตาม category
          if (depositCategory === 'เงินโอนระหว่างบัญชีบริษัท') {
            aiReasoning = 'โอนระหว่างบริษัท (เติมบุญ/ไอริส)'
          } else if (depositCategory === 'ยอดมัดจำ') {
            aiReasoning = `ยอดเงิน ${transaction.deposit.toLocaleString()} ตรงกับยอดมัดจำ (3,000 / 5,000 / 7,000)`
          } else {
            aiReasoning = 'รายได้จากการให้บริการ'
          }
        }
      }
      // ถ้าเป็น withdrawal ให้จัดหมวดหมู่
      else if (transaction.withdrawal && transaction.withdrawal > 0) {
        // 1. ลองใช้ hardcoded rules ก่อน (เร็วกว่า)
        const ruleCategory = categorizeTransaction(transaction)

        // Debug: log inter-company patterns
        const debugText = `${transaction.description} ${transaction.rawDescription} ${transaction.note || ''}`
        if (debugText.includes('ไอริส') || debugText.includes('เติมบุญ') || debugText.toLowerCase().includes('iris') || debugText.toLowerCase().includes('termboon')) {
          console.log('[Inter-Company Debug]', {
            note: transaction.note,
            description: transaction.description,
            rawDescription: transaction.rawDescription,
            detectedCategory: ruleCategory,
            textChecked: debugText,
          })
        }

        if (ruleCategory !== 'ไม่ระบุ') {
          // Rules matched - ใช้ผลลัพธ์จาก rules
          aiCategory = ruleCategory
          aiConfidence = 'high'
          aiReasoning = 'ตรงกับกฎที่กำหนด'
        } else {
          // 2. ถ้า rules ไม่ match ให้ใช้ AI
          try {
            const result = await categorizeWithAI({
              note: transaction.note || '',
              description: `${transaction.description || ''} ${transaction.rawDescription || ''}`,
              withdrawal: transaction.withdrawal,
            })

            if (result) {
              aiCategory = result.category
              aiConfidence = result.confidence
              aiReasoning = result.reasoning
            }
          } catch (error) {
            console.error('AI error:', error)
          }

          // Delay เพื่อไม่ให้ rate limit
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      previews.push({
        transaction,
        aiCategory,
        aiConfidence,
        aiReasoning,
        selectedCategory: aiCategory, // เริ่มต้น = AI suggestion
      })
    }

    return {
      success: true,
      message: `พร้อมให้ตรวจสอบ ${cleanedTransactions.length} รายการ`,
      previews,
      stats: {
        totalRows: rawRows.length,
        validRows: cleanedTransactions.length,
        withdrawalRows: withdrawals.length,
        depositRows: deposits.length,
      },
    }
  } catch (error) {
    console.error('Preview error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
    }
  }
}
