'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import {
  getSummaryData,
  getBalanceTrend,
  getExpensesByCategory,
  getRecentTransactions,
  getTransactionsPaginated,
  type SummaryData,
  type BalanceTrendData,
  type CategoryData,
  type TransactionData,
  type PaginatedTransactions,
  type DateRangeFilter,
  type TransactionTypeFilter,
} from '@/lib/actions/dashboard'

interface DateRange {
  from?: Date
  to?: Date
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// Convert DateRange to DateRangeFilter
function toFilter(dateRange: DateRange, accountNumber?: string): DateRangeFilter | undefined {
  const hasDateFilter = dateRange.from || dateRange.to
  const hasAccountFilter = Boolean(accountNumber)

  if (!hasDateFilter && !hasAccountFilter) {
    return undefined
  }

  return {
    from: dateRange.from?.toISOString(),
    to: dateRange.to?.toISOString(),
    accountNumber,
  }
}

interface UseDashboardDataOptions {
  initialSummary: SummaryData
  initialBalanceTrend: BalanceTrendData[]
  initialExpensesByCategory: CategoryData[]
  initialTransactions: TransactionData[]
  dateRange: DateRange
  accountNumber?: string
  debounceMs?: number
}

export function useDashboardData({
  initialSummary,
  initialBalanceTrend,
  initialExpensesByCategory,
  initialTransactions,
  dateRange,
  accountNumber,
  debounceMs = 300,
}: UseDashboardDataOptions) {
  // Debounce the filters to prevent rapid API calls
  const debouncedDateRange = useDebounce(dateRange, debounceMs)
  const debouncedAccount = useDebounce(accountNumber, debounceMs)
  const filter = toFilter(debouncedDateRange, debouncedAccount)
  const hasFilter = Boolean(filter)

  // Summary query
  const summaryQuery = useQuery({
    queryKey: ['summary', filter?.from, filter?.to, filter?.accountNumber],
    queryFn: () => getSummaryData(filter),
    initialData: hasFilter ? undefined : initialSummary,
    enabled: hasFilter,
    staleTime: 60 * 1000,
  })

  // Balance trend query
  const balanceTrendQuery = useQuery({
    queryKey: ['balanceTrend', filter?.from, filter?.to, filter?.accountNumber],
    queryFn: () => getBalanceTrend(filter),
    initialData: hasFilter ? undefined : initialBalanceTrend,
    enabled: hasFilter,
    staleTime: 60 * 1000,
  })

  // Expenses by category query
  const expensesByCategoryQuery = useQuery({
    queryKey: ['expensesByCategory', filter?.from, filter?.to, filter?.accountNumber],
    queryFn: () => getExpensesByCategory(filter),
    initialData: hasFilter ? undefined : initialExpensesByCategory,
    enabled: hasFilter,
    staleTime: 60 * 1000,
  })

  // Recent transactions query
  const transactionsQuery = useQuery({
    queryKey: ['transactions', undefined, 100, filter?.from, filter?.to, filter?.accountNumber],
    queryFn: () => getRecentTransactions(undefined, 100, filter),
    initialData: hasFilter ? undefined : initialTransactions,
    enabled: hasFilter,
    staleTime: 60 * 1000,
  })

  // Calculate loading state
  const isLoading = hasFilter && (
    summaryQuery.isFetching ||
    balanceTrendQuery.isFetching ||
    expensesByCategoryQuery.isFetching ||
    transactionsQuery.isFetching
  )

  // Return data with fallback to initial values
  return {
    summary: summaryQuery.data ?? initialSummary,
    balanceTrend: balanceTrendQuery.data ?? initialBalanceTrend,
    expensesByCategory: expensesByCategoryQuery.data ?? initialExpensesByCategory,
    transactions: transactionsQuery.data ?? initialTransactions,
    isLoading,
  }
}

interface UseTransactionsOptions {
  initialData: TransactionData[]
  categoryFilter?: string
  transactionType?: TransactionTypeFilter
  dateRange?: DateRange
  accountNumber?: string
  debounceMs?: number
}

export function useTransactions({
  initialData,
  categoryFilter,
  transactionType,
  dateRange,
  accountNumber,
  debounceMs = 300,
}: UseTransactionsOptions) {
  const debouncedCategory = useDebounce(categoryFilter, debounceMs)
  const debouncedType = useDebounce(transactionType, debounceMs)
  const debouncedAccount = useDebounce(accountNumber, debounceMs)
  const filter = dateRange ? toFilter(dateRange, debouncedAccount) : (debouncedAccount ? { accountNumber: debouncedAccount } : undefined)

  // Check if we're using default view (no filters)
  const isDefaultView = (!debouncedCategory || debouncedCategory === 'all')
    && !filter
    && (!debouncedType || debouncedType === 'all')

  const query = useQuery({
    queryKey: ['transactions', debouncedCategory, 100, filter?.from, filter?.to, filter?.accountNumber, debouncedType],
    queryFn: () => getRecentTransactions(debouncedCategory, 100, filter, debouncedType),
    initialData: isDefaultView ? initialData : undefined,
    staleTime: 60 * 1000,
    enabled: true,
  })

  // Only fallback to initialData if we're in default view
  // Otherwise show query data (or empty array while loading)
  return {
    transactions: isDefaultView ? (query.data ?? initialData) : (query.data ?? []),
    isLoading: query.isFetching,
  }
}

interface UsePaginatedTransactionsOptions {
  initialData: PaginatedTransactions
  categoryFilter?: string
  transactionType?: TransactionTypeFilter
  dateRange?: DateRange
  accountNumber?: string
  pageSize?: number
  debounceMs?: number
}

export function usePaginatedTransactions({
  initialData,
  categoryFilter,
  transactionType,
  dateRange,
  accountNumber,
  pageSize = 20,
  debounceMs = 300,
}: UsePaginatedTransactionsOptions) {
  const [page, setPage] = useState(1)
  const debouncedCategory = useDebounce(categoryFilter, debounceMs)
  const debouncedType = useDebounce(transactionType, debounceMs)
  const debouncedAccount = useDebounce(accountNumber, debounceMs)
  const filter = dateRange ? toFilter(dateRange, debouncedAccount) : (debouncedAccount ? { accountNumber: debouncedAccount } : undefined)

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedCategory, debouncedType, filter?.from, filter?.to, filter?.accountNumber])

  // Check if we're using default view (no filters)
  const isDefaultView = (!debouncedCategory || debouncedCategory === 'all')
    && !filter
    && (!debouncedType || debouncedType === 'all')
    && page === 1

  const query = useQuery({
    queryKey: ['transactions-paginated', page, pageSize, debouncedCategory, filter?.from, filter?.to, filter?.accountNumber, debouncedType],
    queryFn: () => getTransactionsPaginated(page, pageSize, debouncedCategory, filter, debouncedType),
    initialData: isDefaultView ? initialData : undefined,
    staleTime: 60 * 1000,
    enabled: true,
  })

  const result = query.data ?? initialData

  return {
    transactions: result.data,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
    isLoading: query.isFetching,
    setPage,
    // Helper functions
    goToPage: (p: number) => setPage(Math.max(1, Math.min(p, result.totalPages))),
    nextPage: () => setPage((prev) => Math.min(prev + 1, result.totalPages)),
    prevPage: () => setPage((prev) => Math.max(prev - 1, 1)),
    hasNextPage: result.page < result.totalPages,
    hasPrevPage: result.page > 1,
  }
}
