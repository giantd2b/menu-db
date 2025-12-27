'use server'

import { prisma } from '@/lib/prisma'
import { unstable_cache, revalidateTag } from 'next/cache'

const CACHE_REVALIDATE_SECONDS = 60 // 1 minute
const DASHBOARD_CACHE_TAG = 'dashboard-data'

/**
 * Invalidate all dashboard cache
 */
export async function invalidateDashboardCache() {
  revalidateTag(DASHBOARD_CACHE_TAG)
}

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
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: [DASHBOARD_CACHE_TAG] }
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
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: [DASHBOARD_CACHE_TAG] }
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
    { revalidate: CACHE_REVALIDATE_SECONDS, tags: [DASHBOARD_CACHE_TAG] }
  )
  return cachedFn()
}

/**
 * ดึงข้อมูลแนวโน้ม Balance ตามวัน
 */
async function getBalanceTrendInternal(filter?: DateRangeFilter): Promise<BalanceTrendData[]> {
  const where = getFilterWhereClause(filter)

  // Check if specific account is selected
  const isAllAccounts = !filter?.accountNumber

  if (isAllAccounts) {
    // Get all unique accounts
    const accounts = await prisma.transaction.findMany({
      distinct: ['accountNumber'],
      where: { accountNumber: { not: null } },
      select: { accountNumber: true },
    })

    // Get all transactions with account info
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'asc' }, { accountNumber: 'asc' }],
      select: {
        date: true,
        balance: true,
        accountNumber: true,
      },
    })

    // Track last known balance for each account
    const accountLastBalance = new Map<string, number>()

    // Initialize with 0 for all accounts
    accounts.forEach((acc) => {
      if (acc.accountNumber) {
        accountLastBalance.set(acc.accountNumber, 0)
      }
    })

    // Group by date, tracking each account's last balance
    const dateBalanceMap = new Map<string, Map<string, number>>()

    transactions.forEach((t) => {
      const dateStr = t.date.toISOString().split('T')[0]
      const accNum = t.accountNumber || 'unknown'

      // Update last known balance for this account
      accountLastBalance.set(accNum, Number(t.balance))

      // Store snapshot of all account balances for this date
      if (!dateBalanceMap.has(dateStr)) {
        dateBalanceMap.set(dateStr, new Map(accountLastBalance))
      } else {
        dateBalanceMap.get(dateStr)!.set(accNum, Number(t.balance))
      }
    })

    // Calculate total balance for each date
    const result: BalanceTrendData[] = []
    let runningBalances = new Map<string, number>()

    // Initialize running balances
    accounts.forEach((acc) => {
      if (acc.accountNumber) {
        runningBalances.set(acc.accountNumber, 0)
      }
    })

    // Sort dates and calculate cumulative totals
    const sortedDates = Array.from(dateBalanceMap.keys()).sort()

    for (const date of sortedDates) {
      const dateBalances = dateBalanceMap.get(date)!

      // Update running balances with today's values
      dateBalances.forEach((balance, accNum) => {
        runningBalances.set(accNum, balance)
      })

      // Sum all account balances
      let totalBalance = 0
      runningBalances.forEach((balance) => {
        totalBalance += balance
      })

      result.push({ date, balance: totalBalance })
    }

    return result
  } else {
    // Single account - original logic
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
}

export async function getBalanceTrend(filter?: DateRangeFilter): Promise<BalanceTrendData[]> {
  const cacheKey = `balance-trend-${filter?.from || 'all'}-${filter?.to || 'all'}-${filter?.accountNumber || 'all'}`
  const cachedFn = unstable_cache(
    () => getBalanceTrendInternal(filter),
    [cacheKey],
    { revalidate: CACHE_REVALIDATE_SECONDS, tags: [DASHBOARD_CACHE_TAG] }
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
    { revalidate: CACHE_REVALIDATE_SECONDS, tags: [DASHBOARD_CACHE_TAG] }
  )
  return cachedFn()
}

/**
 * Transaction type filter
 */
export type TransactionTypeFilter = 'all' | 'withdrawal' | 'deposit'

/**
 * Paginated transactions result
 */
export interface PaginatedTransactions {
  data: TransactionData[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * ดึงรายการ Transactions พร้อม pagination
 */
async function getTransactionsPaginatedInternal(
  page: number = 1,
  pageSize: number = 20,
  categoryFilter?: string,
  filter?: DateRangeFilter,
  transactionType?: TransactionTypeFilter
): Promise<PaginatedTransactions> {
  const where = getFilterWhereClause(filter)

  const categoryWhere = categoryFilter && categoryFilter !== 'all'
    ? { category: { name: categoryFilter } }
    : {}

  // Add transaction type filter
  const typeWhere = transactionType === 'withdrawal'
    ? { withdrawal: { not: null } }
    : transactionType === 'deposit'
      ? { deposit: { not: null } }
      : {}

  const combinedWhere = {
    ...where,
    ...categoryWhere,
    ...typeWhere,
  }

  // Get total count and data in parallel
  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where: combinedWhere }),
    prisma.transaction.findMany({
      where: combinedWhere,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    }),
  ])

  return {
    data: transactions.map((t) => ({
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
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getTransactionsPaginated(
  page: number = 1,
  pageSize: number = 20,
  categoryFilter?: string,
  filter?: DateRangeFilter,
  transactionType?: TransactionTypeFilter
): Promise<PaginatedTransactions> {
  const cacheKey = `transactions-paginated-${page}-${pageSize}-${categoryFilter || 'all'}-${filter?.from || 'all'}-${filter?.to || 'all'}-${filter?.accountNumber || 'all'}-${transactionType || 'all'}`
  const cachedFn = unstable_cache(
    () => getTransactionsPaginatedInternal(page, pageSize, categoryFilter, filter, transactionType),
    [cacheKey],
    { revalidate: CACHE_REVALIDATE_SECONDS, tags: [DASHBOARD_CACHE_TAG] }
  )
  return cachedFn()
}

/**
 * ดึงรายการ Transactions ล่าสุด (legacy - for backward compatibility)
 */
async function getRecentTransactionsInternal(
  categoryFilter?: string,
  limit: number = 100,
  filter?: DateRangeFilter,
  transactionType?: TransactionTypeFilter
): Promise<TransactionData[]> {
  const result = await getTransactionsPaginatedInternal(1, limit, categoryFilter, filter, transactionType)
  return result.data
}

export async function getRecentTransactions(
  categoryFilter?: string,
  limit: number = 20,
  filter?: DateRangeFilter,
  transactionType?: TransactionTypeFilter
): Promise<TransactionData[]> {
  const cacheKey = `transactions-${categoryFilter || 'all'}-${limit}-${filter?.from || 'all'}-${filter?.to || 'all'}-${filter?.accountNumber || 'all'}-${transactionType || 'all'}`
  const cachedFn = unstable_cache(
    () => getRecentTransactionsInternal(categoryFilter, limit, filter, transactionType),
    [cacheKey],
    { revalidate: CACHE_REVALIDATE_SECONDS, tags: [DASHBOARD_CACHE_TAG] }
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
  { revalidate: CACHE_REVALIDATE_SECONDS * 5, tags: [DASHBOARD_CACHE_TAG] } // categories change less frequently
)

export async function getCategories(): Promise<{ id: string; name: string }[]> {
  return getCategoriesCached()
}

/**
 * ข้อมูลยอดคงเหลือแต่ละบัญชี
 */
export interface AccountBalance {
  accountNumber: string
  accountName: string | null
  accountType: string | null
  balance: number
  lastUpdated: string
}

/**
 * ดึงยอดคงเหลือล่าสุดของทุกบัญชี
 */
async function getAllAccountBalancesInternal(): Promise<AccountBalance[]> {
  // Get unique accounts
  const accounts = await prisma.transaction.findMany({
    distinct: ['accountNumber'],
    where: {
      accountNumber: { not: null },
    },
    select: {
      accountNumber: true,
    },
  })

  // Get latest balance for each account
  const balances: AccountBalance[] = []

  for (const acc of accounts) {
    if (!acc.accountNumber) continue

    const latest = await prisma.transaction.findFirst({
      where: { accountNumber: acc.accountNumber },
      orderBy: { date: 'desc' },
      select: {
        balance: true,
        accountName: true,
        accountType: true,
        date: true,
      },
    })

    if (latest) {
      balances.push({
        accountNumber: acc.accountNumber,
        accountName: latest.accountName,
        accountType: latest.accountType,
        balance: Number(latest.balance),
        lastUpdated: latest.date.toISOString(),
      })
    }
  }

  return balances.sort((a, b) => b.balance - a.balance)
}

const getAllAccountBalancesCached = unstable_cache(
  getAllAccountBalancesInternal,
  ['all-account-balances'],
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: [DASHBOARD_CACHE_TAG] }
)

export async function getAllAccountBalances(): Promise<AccountBalance[]> {
  return getAllAccountBalancesCached()
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

/**
 * Bulk update transaction categories
 */
export async function bulkUpdateTransactionCategory(
  transactionIds: string[],
  categoryId: string | null
): Promise<{ success: boolean; updatedCount: number }> {
  try {
    const result = await prisma.transaction.updateMany({
      where: {
        id: { in: transactionIds },
      },
      data: {
        categoryId: categoryId,
      },
    })

    // Invalidate cache after update
    await invalidateDashboardCache()

    return {
      success: true,
      updatedCount: result.count,
    }
  } catch (error) {
    console.error('Bulk update failed:', error)
    return {
      success: false,
      updatedCount: 0,
    }
  }
}
