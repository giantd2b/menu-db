import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'
import { cleanTransactionRow, type RawTransactionRow } from '@/lib/utils/clean-data'
import * as fs from 'fs'
import { getTransactionsPaginated } from '@/lib/actions/dashboard'

// GET /api/debug - Check database status
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const testPagination = searchParams.get('pagination') === 'true'
    const page = parseInt(searchParams.get('page') || '1')

    // Test pagination if requested
    if (testPagination) {
      const pageSize = 20
      const txType = searchParams.get('type') as 'all' | 'withdrawal' | 'deposit' | undefined
      const result = await getTransactionsPaginated(page, pageSize, undefined, undefined, txType || undefined)
      return NextResponse.json({
        status: 'ok',
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
          dataCount: result.data.length,
          firstItem: result.data[0] ? {
            date: result.data[0].date,
            withdrawal: result.data[0].withdrawal,
            deposit: result.data[0].deposit,
          } : null,
          lastItem: result.data[result.data.length - 1] ? {
            date: result.data[result.data.length - 1].date,
            withdrawal: result.data[result.data.length - 1].withdrawal,
            deposit: result.data[result.data.length - 1].deposit,
          } : null,
        }
      })
    }

    const transactionCount = await prisma.transaction.count()
    const categoryCount = await prisma.category.count()
    const withdrawalCount = await prisma.transaction.count({
      where: { withdrawal: { not: null } }
    })
    const depositCount = await prisma.transaction.count({
      where: { deposit: { not: null } }
    })

    // Get recent transactions directly from DB (bypass cache)
    const recentTransactions = await prisma.transaction.findMany({
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        category: {
          select: { name: true }
        }
      }
    })

    // Get recent withdrawal transactions
    const recentWithdrawals = await prisma.transaction.findMany({
      where: { withdrawal: { not: null } },
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        category: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json({
      status: 'ok',
      transactionCount,
      categoryCount,
      withdrawalCount,
      depositCount,
      recentTransactions: recentTransactions.map(tx => ({
        id: tx.id,
        date: tx.date,
        note: tx.note,
        withdrawal: tx.withdrawal,
        deposit: tx.deposit,
        category: tx.category?.name,
      })),
      recentWithdrawals: recentWithdrawals.map(tx => ({
        id: tx.id,
        date: tx.date,
        note: tx.note,
        withdrawal: tx.withdrawal,
        rawDescription: tx.rawDescription,
        category: tx.category?.name,
      }))
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST /api/debug - Clear cache and refresh
export async function POST() {
  try {
    // Revalidate all cache tags
    revalidatePath('/', 'layout')
    revalidatePath('/dashboard', 'page')

    return NextResponse.json({
      status: 'ok',
      message: 'Cache cleared successfully'
    })
  } catch (error) {
    console.error('Cache clear error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH /api/debug - Test the full preview + save flow
export async function PATCH() {
  try {
    const filePath = 'C:/Users/OatJirakitt/Downloads/HISTSTMTAN_RPT2512261928481618_251226192858101.XLSX'

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Import preview function
    const { previewTransactions } = await import('@/lib/actions/preview-transactions')
    const { saveReviewedTransactions } = await import('@/lib/actions/save-reviewed-transactions')

    // Create FormData with the file
    const fileBuffer = fs.readFileSync(filePath)
    const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const file = new File([blob], 'test.xlsx', { type: blob.type })

    const formData = new FormData()
    formData.append('file', file)

    // Test preview
    const previewResult = await previewTransactions(formData)

    if (!previewResult.success || !previewResult.previews) {
      return NextResponse.json({
        status: 'preview_failed',
        message: previewResult.message,
      })
    }

    // Count withdrawals in preview
    const previewWithdrawals = previewResult.previews.filter(
      p => p.transaction.withdrawal && Number(p.transaction.withdrawal) > 0
    )
    const previewDeposits = previewResult.previews.filter(
      p => p.transaction.deposit && Number(p.transaction.deposit) > 0
    )

    // Clear DB first
    await prisma.transaction.deleteMany({})

    // Test save
    const saveResult = await saveReviewedTransactions(previewResult.previews)

    // Check DB after save
    const dbWithdrawals = await prisma.transaction.count({ where: { withdrawal: { not: null } } })
    const dbDeposits = await prisma.transaction.count({ where: { deposit: { not: null } } })

    return NextResponse.json({
      status: 'ok',
      preview: {
        total: previewResult.previews.length,
        withdrawals: previewWithdrawals.length,
        deposits: previewDeposits.length,
        sampleWithdrawal: previewWithdrawals[0]?.transaction || null,
      },
      save: saveResult,
      dbAfterSave: {
        withdrawals: dbWithdrawals,
        deposits: dbDeposits,
      }
    })
  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}

// PUT /api/debug - Test parsing and directly import file
export async function PUT() {
  try {
    const filePath = 'C:/Users/OatJirakitt/Downloads/HISTSTMTAN_RPT2512261928481618_251226192858101.XLSX'

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read and parse Excel
    const buffer = fs.readFileSync(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json<RawTransactionRow>(sheet, { raw: false, defval: '' })

    // Clean transactions
    const cleanedTransactions = rawRows
      .map(row => cleanTransactionRow(row))
      .filter((t): t is NonNullable<typeof t> => t !== null)

    // Clear existing transactions first
    await prisma.transaction.deleteMany({})

    // Get or create default category
    let defaultCategory = await prisma.category.findFirst({ where: { name: 'ไม่ระบุ' } })
    if (!defaultCategory) {
      defaultCategory = await prisma.category.create({
        data: { name: 'ไม่ระบุ', description: 'ยังไม่ได้จัดหมวดหมู่', color: '#cbd5e1' }
      })
    }

    // Import all transactions directly
    let insertedWithdrawals = 0
    let insertedDeposits = 0
    const errors: string[] = []

    for (const tx of cleanedTransactions) {
      try {
        await prisma.transaction.create({
          data: {
            date: tx.date,
            description: tx.description,
            rawDescription: tx.rawDescription,
            note: tx.note,
            withdrawal: tx.withdrawal,
            deposit: tx.deposit,
            balance: tx.balance,
            accountNumber: tx.accountNumber,
            accountName: tx.accountName,
            accountType: tx.accountType,
            channel: tx.channel,
            transactionCode: tx.transactionCode,
            chequeNumber: tx.chequeNumber,
            categoryId: defaultCategory.id,
          }
        })

        if (tx.withdrawal && tx.withdrawal > 0) insertedWithdrawals++
        if (tx.deposit && tx.deposit > 0) insertedDeposits++
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    // Revalidate
    revalidatePath('/dashboard')
    revalidatePath('/')

    return NextResponse.json({
      status: 'ok',
      rawRowCount: rawRows.length,
      cleanedCount: cleanedTransactions.length,
      insertedWithdrawals,
      insertedDeposits,
      totalInserted: insertedWithdrawals + insertedDeposits,
      errors: errors.slice(0, 5), // Show first 5 errors if any
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
