'use server'

import { prisma } from '@/lib/prisma'
import { unstable_cache, revalidateTag } from 'next/cache'

const CACHE_REVALIDATE_SECONDS = 60
const DASHBOARD_CACHE_TAG = 'dashboard-data'

// Types
export type PeriodType = 'monthly' | 'quarterly' | 'custom'

export interface PeriodOption {
  type: PeriodType
  year: number
  month?: number    // 1-12 for monthly
  quarter?: number  // 1-4 for quarterly
  from?: string     // ISO date for custom
  to?: string       // ISO date for custom
}

export interface PnLCategoryData {
  categoryId: string | null
  categoryName: string
  categoryColor: string
  amount: number
  transactionCount: number
  percentage: number
}

export interface PnLSummary {
  totalIncome: number
  totalExpense: number
  netProfit: number
  incomeByCategory: PnLCategoryData[]
  expenseByCategory: PnLCategoryData[]
  period: {
    from: string
    to: string
    label: string
  }
}

export interface AvailablePeriods {
  years: number[]
  monthsByYear: Record<number, number[]>
  quartersByYear: Record<number, number[]>
  minDate: string | null
  maxDate: string | null
}

// Category to exclude for inter-account transfers
const TRANSFER_CATEGORY_NAME = 'เงินโอนระหว่างบัญชีบริษัท'

// Thai month names
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

/**
 * Convert Buddhist Era to Christian Era and vice versa
 */
function toBuddhistYear(year: number): number {
  return year + 543
}

/**
 * Get date range from period option (internal helper)
 */
function getPeriodDateRange(period: PeriodOption): { from: Date; to: Date } {
  if (period.type === 'custom' && period.from && period.to) {
    return {
      from: new Date(period.from),
      to: new Date(period.to),
    }
  }

  const year = period.year

  if (period.type === 'monthly' && period.month) {
    const from = new Date(year, period.month - 1, 1)
    const to = new Date(year, period.month, 0, 23, 59, 59, 999)
    return { from, to }
  }

  if (period.type === 'quarterly' && period.quarter) {
    const startMonth = (period.quarter - 1) * 3
    const from = new Date(year, startMonth, 1)
    const to = new Date(year, startMonth + 3, 0, 23, 59, 59, 999)
    return { from, to }
  }

  // Default to current month
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { from, to }
}

/**
 * Get period label for display (internal helper)
 */
function getPeriodLabel(period: PeriodOption): string {
  const buddhistYear = toBuddhistYear(period.year)

  if (period.type === 'monthly' && period.month) {
    return `${THAI_MONTHS[period.month - 1]} ${buddhistYear}`
  }

  if (period.type === 'quarterly' && period.quarter) {
    return `ไตรมาส ${period.quarter}/${buddhistYear}`
  }

  if (period.type === 'custom' && period.from && period.to) {
    const fromDate = new Date(period.from)
    const toDate = new Date(period.to)
    const formatDate = (d: Date) => {
      return `${d.getDate()}/${d.getMonth() + 1}/${toBuddhistYear(d.getFullYear())}`
    }
    return `${formatDate(fromDate)} - ${formatDate(toDate)}`
  }

  return `ปี ${buddhistYear}`
}

/**
 * Get income grouped by category
 */
async function getIncomeByCategoryInternal(
  from: Date,
  to: Date,
  accountNumber?: string,
  excludeTransfers: boolean = true
): Promise<PnLCategoryData[]> {
  const where: Record<string, unknown> = {
    date: { gte: from, lte: to },
    deposit: { not: null },
  }

  if (accountNumber) {
    where.accountNumber = accountNumber
  }

  // Exclude inter-account transfers if requested
  if (excludeTransfers) {
    where.category = {
      NOT: { name: TRANSFER_CATEGORY_NAME }
    }
  }

  const deposits = await prisma.transaction.findMany({
    where,
    select: {
      deposit: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  })

  // Group by category
  const categoryMap = new Map<string, {
    categoryId: string | null
    categoryName: string
    categoryColor: string
    amount: number
    count: number
  }>()

  let totalIncome = 0

  deposits.forEach((t) => {
    const amount = Number(t.deposit)
    totalIncome += amount

    const categoryId = t.category?.id || null
    const categoryName = t.category?.name || 'ไม่ระบุ'
    const categoryColor = t.category?.color || '#94a3b8'
    const key = categoryName

    const current = categoryMap.get(key) || {
      categoryId,
      categoryName,
      categoryColor,
      amount: 0,
      count: 0,
    }
    current.amount += amount
    current.count += 1
    categoryMap.set(key, current)
  })

  return Array.from(categoryMap.values())
    .map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      categoryColor: item.categoryColor,
      amount: item.amount,
      transactionCount: item.count,
      percentage: totalIncome > 0 ? (item.amount / totalIncome) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

/**
 * Get expenses grouped by category
 */
async function getExpenseByCategoryInternal(
  from: Date,
  to: Date,
  accountNumber?: string,
  excludeTransfers: boolean = true
): Promise<PnLCategoryData[]> {
  const where: Record<string, unknown> = {
    date: { gte: from, lte: to },
    withdrawal: { not: null },
  }

  if (accountNumber) {
    where.accountNumber = accountNumber
  }

  // Exclude inter-account transfers if requested
  if (excludeTransfers) {
    where.category = {
      NOT: { name: TRANSFER_CATEGORY_NAME }
    }
  }

  const withdrawals = await prisma.transaction.findMany({
    where,
    select: {
      withdrawal: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  })

  // Group by category
  const categoryMap = new Map<string, {
    categoryId: string | null
    categoryName: string
    categoryColor: string
    amount: number
    count: number
  }>()

  let totalExpense = 0

  withdrawals.forEach((t) => {
    const amount = Number(t.withdrawal)
    totalExpense += amount

    const categoryId = t.category?.id || null
    const categoryName = t.category?.name || 'ไม่ระบุ'
    const categoryColor = t.category?.color || '#94a3b8'
    const key = categoryName

    const current = categoryMap.get(key) || {
      categoryId,
      categoryName,
      categoryColor,
      amount: 0,
      count: 0,
    }
    current.amount += amount
    current.count += 1
    categoryMap.set(key, current)
  })

  return Array.from(categoryMap.values())
    .map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      categoryColor: item.categoryColor,
      amount: item.amount,
      transactionCount: item.count,
      percentage: totalExpense > 0 ? (item.amount / totalExpense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

/**
 * Get P&L summary for a period
 */
async function getPnLSummaryInternal(
  period: PeriodOption,
  accountNumber?: string,
  excludeTransfers: boolean = true
): Promise<PnLSummary> {
  const { from, to } = getPeriodDateRange(period)
  const label = getPeriodLabel(period)

  const [incomeByCategory, expenseByCategory] = await Promise.all([
    getIncomeByCategoryInternal(from, to, accountNumber, excludeTransfers),
    getExpenseByCategoryInternal(from, to, accountNumber, excludeTransfers),
  ])

  const totalIncome = incomeByCategory.reduce((sum, item) => sum + item.amount, 0)
  const totalExpense = expenseByCategory.reduce((sum, item) => sum + item.amount, 0)
  const netProfit = totalIncome - totalExpense

  return {
    totalIncome,
    totalExpense,
    netProfit,
    incomeByCategory,
    expenseByCategory,
    period: {
      from: from.toISOString(),
      to: to.toISOString(),
      label,
    },
  }
}

export async function getPnLSummary(
  period: PeriodOption,
  accountNumber?: string,
  excludeTransfers: boolean = true
): Promise<PnLSummary> {
  const cacheKey = `pnl-summary-${period.type}-${period.year}-${period.month || ''}-${period.quarter || ''}-${period.from || ''}-${period.to || ''}-${accountNumber || 'all'}-${excludeTransfers ? 'excl' : 'incl'}`
  const cachedFn = unstable_cache(
    () => getPnLSummaryInternal(period, accountNumber, excludeTransfers),
    [cacheKey],
    { revalidate: CACHE_REVALIDATE_SECONDS, tags: [DASHBOARD_CACHE_TAG] }
  )
  return cachedFn()
}

/**
 * Get available periods based on transaction data
 */
async function getAvailablePeriodsInternal(): Promise<AvailablePeriods> {
  const [oldest, newest] = await Promise.all([
    prisma.transaction.findFirst({
      orderBy: { date: 'asc' },
      select: { date: true },
    }),
    prisma.transaction.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true },
    }),
  ])

  if (!oldest || !newest) {
    return {
      years: [],
      monthsByYear: {},
      quartersByYear: {},
      minDate: null,
      maxDate: null,
    }
  }

  const minDate = oldest.date
  const maxDate = newest.date

  // Get all distinct year-month combinations
  const transactions = await prisma.transaction.findMany({
    select: { date: true },
    distinct: ['date'],
  })

  const yearMonthSet = new Set<string>()
  transactions.forEach((t) => {
    const year = t.date.getFullYear()
    const month = t.date.getMonth() + 1
    yearMonthSet.add(`${year}-${month}`)
  })

  const years = new Set<number>()
  const monthsByYear: Record<number, number[]> = {}
  const quartersByYear: Record<number, number[]> = {}

  yearMonthSet.forEach((ym) => {
    const [yearStr, monthStr] = ym.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr)
    const quarter = Math.ceil(month / 3)

    years.add(year)

    if (!monthsByYear[year]) {
      monthsByYear[year] = []
    }
    if (!monthsByYear[year].includes(month)) {
      monthsByYear[year].push(month)
    }

    if (!quartersByYear[year]) {
      quartersByYear[year] = []
    }
    if (!quartersByYear[year].includes(quarter)) {
      quartersByYear[year].push(quarter)
    }
  })

  // Sort months and quarters
  Object.keys(monthsByYear).forEach((year) => {
    monthsByYear[parseInt(year)].sort((a, b) => a - b)
  })
  Object.keys(quartersByYear).forEach((year) => {
    quartersByYear[parseInt(year)].sort((a, b) => a - b)
  })

  return {
    years: Array.from(years).sort((a, b) => b - a), // Descending order
    monthsByYear,
    quartersByYear,
    minDate: minDate.toISOString(),
    maxDate: maxDate.toISOString(),
  }
}

export async function getAvailablePeriods(): Promise<AvailablePeriods> {
  const cachedFn = unstable_cache(
    getAvailablePeriodsInternal,
    ['available-periods'],
    { revalidate: CACHE_REVALIDATE_SECONDS, tags: [DASHBOARD_CACHE_TAG] }
  )
  return cachedFn()
}

/**
 * Transaction data for category detail view
 */
export interface CategoryTransactionData {
  id: string
  date: string
  description: string
  note: string | null
  amount: number
  accountNumber: string | null
  accountName: string | null
}

/**
 * Get transactions by category for detail view
 */
export async function getTransactionsByCategory(
  categoryId: string | null,
  periodFrom: string,
  periodTo: string,
  type: 'income' | 'expense',
  accountNumber?: string
): Promise<CategoryTransactionData[]> {
  const from = new Date(periodFrom)
  const to = new Date(periodTo)

  const where: Record<string, unknown> = {
    date: { gte: from, lte: to },
  }

  // Filter by income (deposit) or expense (withdrawal)
  if (type === 'income') {
    where.deposit = { not: null }
  } else {
    where.withdrawal = { not: null }
  }

  // Filter by category
  if (categoryId === null) {
    where.categoryId = null
  } else {
    where.categoryId = categoryId
  }

  // Filter by account
  if (accountNumber) {
    where.accountNumber = accountNumber
  }

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      date: true,
      description: true,
      note: true,
      withdrawal: true,
      deposit: true,
      accountNumber: true,
      accountName: true,
    },
    orderBy: { date: 'desc' },
  })

  return transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    description: t.description,
    note: t.note,
    amount: type === 'income' ? Number(t.deposit) : Number(t.withdrawal),
    accountNumber: t.accountNumber,
    accountName: t.accountName,
  }))
}

