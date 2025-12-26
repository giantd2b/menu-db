'use server'

import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'

const CACHE_REVALIDATE_SECONDS = 60 // 1 minute

/**
 * Date range filter
 */
export interface DateRangeFilter {
  from?: string  // ISO date string
  to?: string    // ISO date string
  accountNumber?: string  // filter by account
}

/**
 * ข้อมูลบัญชี
 */
export interface AccountInfo {
  accountNumber: string | null
  accountName: string | null
  accountType: string | null
}

/**
 * ข้อมูลสรุปยอดรวม
 */
export interface SummaryData {
  totalIncome: number
  totalExpense: number
  netBalance: number
  transactionCount: number
  account: AccountInfo | null
}

/**
 * ข้อมูลแนวโน้ม Balance
 */
export interface BalanceTrendData {
  date: string
  balance: number
}

/**
 * ข้อมูลสัดส่วนตามหมวดหมู่
 */
export interface CategoryData {
  name: string
  value: number
  color: string
}

/**
 * ข้อมูล Transaction สำหรับแสดงในตาราง
 */
export interface TransactionData {
  id: string
  date: string
  description: string      // Tr Description (processed)
  rawDescription: string   // Description จาก Excel
  note: string | null
  withdrawal: number | null
  deposit: number | null
  balance: number
  category: string | null
  categoryColor: string | null
  accountNumber: string | null
  accountName: string | null
  accountType: string | null
}

/**
 * สร้าง where clause จาก date range และ account
 */
function getFilterWhereClause(filter?: DateRangeFilter) {
  const where: Record<string, unknown> = {}

  if (filter?.from || filter?.to) {
    const dateFilter: { gte?: Date; lte?: Date } = {}

    if (filter.from) {
      dateFilter.gte = new Date(filter.from)
    }

    if (filter.to) {
      const toDate = new Date(filter.to)
      toDate.setHours(23, 59, 59, 999)
      dateFilter.lte = toDate
    }

    where.date = dateFilter
  }

  if (filter?.accountNumber) {
    where.accountNumber = filter.accountNumber
  }

  return where
}

/**
 * ดึงข้อมูลบัญชีทั้งหมด (unique accounts)
 */
const getAllAccountsCached = unstable_cache(
  async (): Promise<AccountInfo[]> => {
    const accounts = await prisma.transaction.findMany({
      distinct: ['accountNumber'],
      select: {
        accountNumber: true,
        accountName: true,
        accountType: true,
      },
      where: {
        accountNumber: { not: null },
      },
      orderBy: { accountNumber: 'asc' },
    })

    return accounts.map((a) => ({
      accountNumber: a.accountNumber,
      accountName: a.accountName,
      accountType: a.accountType,
    }))
  },
  ['all-accounts'],
  { revalidate: CACHE_REVALIDATE_SECONDS }
)

export async function getAllAccounts(): Promise<AccountInfo[]> {
  return getAllAccountsCached()
}

/**
 * ดึงข้อมูลบัญชี (บัญชีแรก)
 */
const getAccountInfoCached = unstable_cache(
  async (): Promise<AccountInfo | null> => {
    const transaction = await prisma.transaction.findFirst({
      select: {
        accountNumber: true,
        accountName: true,
        accountType: true,
      },
      orderBy: { date: 'desc' },
    })

    if (!transaction) return null

    return {
      accountNumber: transaction.accountNumber,
      accountName: transaction.accountName,
      accountType: transaction.accountType,
    }
  },
  ['account-info'],
  { revalidate: CACHE_REVALIDATE_SECONDS }
)

export async function getAccountInfo(): Promise<AccountInfo | null> {
  return getAccountInfoCached()
}

/**
 * ดึงข้อมูลสรุปยอดรวม
 */
async function getSummaryDataInternal(filter?: DateRangeFilter): Promise<SummaryData> {
  const where = getFilterWhereClause(filter)

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      withdrawal: true,
      deposit: true,
      balance: true,
      accountNumber: true,
      accountName: true,
      accountType: true,
    },
  })

  let totalIncome = 0
  let totalExpense = 0

  transactions.forEach((t) => {
    if (t.deposit) {
      totalIncome += Number(t.deposit)
    }
    if (t.withdrawal) {
      totalExpense += Number(t.withdrawal)
    }
  })

  // หา balance ล่าสุด
  const latest = await prisma.transaction.findFirst({
    where,
    orderBy: { date: 'desc' },
    select: {
      balance: true,
      accountNumber: true,
      accountName: true,
      accountType: true,
    },
  })

  // ใช้ข้อมูลบัญชีจาก latest transaction หรือ filter
  const account: AccountInfo | null = latest
    ? {
        accountNumber: latest.accountNumber,
        accountName: latest.accountName,
        accountType: latest.accountType,
      }
    : null

  return {
    totalIncome,
    totalExpense,
    netBalance: latest ? Number(latest.balance) : 0,
    transactionCount: transactions.length,
    account,
  }
}

export async function getSummaryData(filter?: DateRangeFilter): Promise<SummaryData> {
  const cacheKey = `summary-${filter?.from || 'all'}-${filter?.to || 'all'}-${filter?.accountNumber || 'all'}`
  const cachedFn = unstable_cache(
    () => getSummaryDataInternal(filter),
    [cacheKey],
    { revalidate: CACHE_REVALIDATE_SECONDS }
  )
  return cachedFn()
}

/**
 * ดึงข้อมูลแนวโน้ม Balance ตามวัน
 */
async function getBalanceTrendInternal(filter?: DateRangeFilter): Promise<BalanceTrendData[]> {
  const where = getFilterWhereClause(filter)

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'asc' },
    select: {
      date: true,
      balance: true,
    },
  })

  // Group by date และเอา balance สุดท้ายของวัน
  const dateBalanceMap = new Map<string, number>()

  transactions.forEach((t) => {
    const dateStr = t.date.toISOString().split('T')[0]
    dateBalanceMap.set(dateStr, Number(t.balance))
  })

  return Array.from(dateBalanceMap.entries()).map(([date, balance]) => ({
    date,
    balance,
  }))
}

export async function getBalanceTrend(filter?: DateRangeFilter): Promise<BalanceTrendData[]> {
  const cacheKey = `balance-trend-${filter?.from || 'all'}-${filter?.to || 'all'}-${filter?.accountNumber || 'all'}`
  const cachedFn = unstable_cache(
    () => getBalanceTrendInternal(filter),
    [cacheKey],
    { revalidate: CACHE_REVALIDATE_SECONDS }
  )
  return cachedFn()
}

/**
 * ดึงข้อมูลสัดส่วนการจ่ายเงินตามหมวดหมู่
 */
async function getExpensesByCategoryInternal(filter?: DateRangeFilter): Promise<CategoryData[]> {
  const where = getFilterWhereClause(filter)

  const expenses = await prisma.transaction.findMany({
    where: {
      ...where,
      withdrawal: { not: null },
    },
    select: {
      withdrawal: true,
      category: {
        select: {
          name: true,
          color: true,
        },
      },
    },
  })

  // Group by category
  const categoryMap = new Map<string, { value: number; color: string }>()

  expenses.forEach((t) => {
    const categoryName = t.category?.name || 'Uncategorized'
    const categoryColor = t.category?.color || '#94a3b8'
    const current = categoryMap.get(categoryName) || { value: 0, color: categoryColor }
    current.value += Number(t.withdrawal)
    categoryMap.set(categoryName, current)
  })

  return Array.from(categoryMap.entries())
    .map(([name, data]) => ({
      name,
      value: data.value,
      color: data.color,
    }))
    .sort((a, b) => b.value - a.value)
}

export async function getExpensesByCategory(filter?: DateRangeFilter): Promise<CategoryData[]> {
  const cacheKey = `expenses-category-${filter?.from || 'all'}-${filter?.to || 'all'}-${filter?.accountNumber || 'all'}`
  const cachedFn = unstable_cache(
    () => getExpensesByCategoryInternal(filter),
    [cacheKey],
    { revalidate: CACHE_REVALIDATE_SECONDS }
  )
  return cachedFn()
}

/**
 * ดึงรายการ Transactions ล่าสุด
 */
async function getRecentTransactionsInternal(
  categoryFilter?: string,
  limit: number = 20,
  filter?: DateRangeFilter
): Promise<TransactionData[]> {
  const where = getFilterWhereClause(filter)

  const categoryWhere = categoryFilter && categoryFilter !== 'all'
    ? { category: { name: categoryFilter } }
    : {}

  const transactions = await prisma.transaction.findMany({
    where: {
      ...where,
      ...categoryWhere,
    },
    orderBy: { date: 'desc' },
    take: limit,
    select: {
      id: true,
      date: true,
      description: true,
      rawDescription: true,
      note: true,
      withdrawal: true,
      deposit: true,
      balance: true,
      accountNumber: true,
      accountName: true,
      accountType: true,
      category: {
        select: {
          name: true,
          color: true,
        },
      },
    },
  })

  return transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    description: t.description,
    rawDescription: t.rawDescription,
    note: t.note,
    withdrawal: t.withdrawal ? Number(t.withdrawal) : null,
    deposit: t.deposit ? Number(t.deposit) : null,
    balance: Number(t.balance),
    category: t.category?.name || null,
    categoryColor: t.category?.color || null,
    accountNumber: t.accountNumber,
    accountName: t.accountName,
    accountType: t.accountType,
  }))
}

export async function getRecentTransactions(
  categoryFilter?: string,
  limit: number = 20,
  filter?: DateRangeFilter
): Promise<TransactionData[]> {
  const cacheKey = `transactions-${categoryFilter || 'all'}-${limit}-${filter?.from || 'all'}-${filter?.to || 'all'}-${filter?.accountNumber || 'all'}`
  const cachedFn = unstable_cache(
    () => getRecentTransactionsInternal(categoryFilter, limit, filter),
    [cacheKey],
    { revalidate: CACHE_REVALIDATE_SECONDS }
  )
  return cachedFn()
}

/**
 * ดึงรายการหมวดหมู่ทั้งหมด
 */
const getCategoriesCached = unstable_cache(
  async (): Promise<{ id: string; name: string }[]> => {
    return prisma.category.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    })
  },
  ['categories'],
  { revalidate: CACHE_REVALIDATE_SECONDS * 5 } // categories change less frequently
)

export async function getCategories(): Promise<{ id: string; name: string }[]> {
  return getCategoriesCached()
}

/**
 * ดึงช่วงวันที่ของข้อมูล
 */
export async function getDateRange(): Promise<{ minDate: string | null; maxDate: string | null }> {
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

  return {
    minDate: oldest?.date.toISOString() || null,
    maxDate: newest?.date.toISOString() || null,
  }
}
