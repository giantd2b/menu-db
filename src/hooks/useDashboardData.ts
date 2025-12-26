'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import {
  getSummaryData,
  getBalanceTrend,
  getExpensesByCategory,
  getRecentTransactions,
  type SummaryData,
  type BalanceTrendData,
  type CategoryData,
  type TransactionData,
  type DateRangeFilter,
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
    queryKey: ['transactions', undefined, 20, filter?.from, filter?.to, filter?.accountNumber],
    queryFn: () => getRecentTransactions(undefined, 20, filter),
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
  dateRange?: DateRange
  accountNumber?: string
  debounceMs?: number
}

export function useTransactions({
  initialData,
  categoryFilter,
  dateRange,
  accountNumber,
  debounceMs = 300,
}: UseTransactionsOptions) {
  const debouncedCategory = useDebounce(categoryFilter, debounceMs)
  const debouncedAccount = useDebounce(accountNumber, debounceMs)
  const filter = dateRange ? toFilter(dateRange, debouncedAccount) : (debouncedAccount ? { accountNumber: debouncedAccount } : undefined)

  const query = useQuery({
    queryKey: ['transactions', debouncedCategory, 20, filter?.from, filter?.to, filter?.accountNumber],
    queryFn: () => getRecentTransactions(debouncedCategory, 20, filter),
    initialData: (!debouncedCategory || debouncedCategory === 'all') && !filter ? initialData : undefined,
    staleTime: 60 * 1000,
  })

  return {
    transactions: query.data ?? initialData,
    isLoading: query.isFetching,
  }
}
