'use client'

import { useState } from 'react'
import DateRangePicker, { type DateRange } from './DateRangePicker'
import SummaryCards from './SummaryCards'
import BalanceTrendChart from './BalanceTrendChart'
import CategoryPieChart from './CategoryPieChart'
import RecentTransactions from './RecentTransactions'
import AccountInfoCard from './AccountInfoCard'
import { useDashboardData } from '@/hooks/useDashboardData'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type SummaryData,
  type BalanceTrendData,
  type CategoryData,
  type PaginatedTransactions,
  type AccountInfo,
} from '@/lib/actions/dashboard'

interface DashboardClientProps {
  initialSummary: SummaryData
  initialBalanceTrend: BalanceTrendData[]
  initialExpensesByCategory: CategoryData[]
  initialTransactions: PaginatedTransactions
  categories: { id: string; name: string }[]
  accounts: AccountInfo[]
}

export default function DashboardClient({
  initialSummary,
  initialBalanceTrend,
  initialExpensesByCategory,
  initialTransactions,
  categories,
  accounts,
}: DashboardClientProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  })
  const [selectedAccount, setSelectedAccount] = useState<string>('all')

  // Use React Query hook with debouncing (for summary, charts only)
  const {
    summary,
    balanceTrend,
    expensesByCategory,
    isLoading,
  } = useDashboardData({
    initialSummary,
    initialBalanceTrend,
    initialExpensesByCategory,
    initialTransactions: initialTransactions.data,
    dateRange,
    accountNumber: selectedAccount === 'all' ? undefined : selectedAccount,
    debounceMs: 300,
  })

  // Get display info for selected account
  const selectedAccountInfo = selectedAccount === 'all'
    ? null
    : accounts.find((a) => a.accountNumber === selectedAccount) || null

  return (
    <div className="relative">
      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
          <div className="bg-card p-4 rounded-lg shadow-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>กำลังโหลดข้อมูล...</span>
          </div>
        </div>
      )}

      {/* Account Selector */}
      {accounts.length > 1 && (
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">บัญชี</h2>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="เลือกบัญชี" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกบัญชี</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.accountNumber} value={acc.accountNumber || ''}>
                    {acc.accountName || acc.accountNumber}
                    {acc.accountType && ` (${acc.accountType})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Account Info */}
      <AccountInfoCard account={selectedAccount === 'all' ? summary.account : selectedAccountInfo} />

      {/* Date Range Filter */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">ช่วงเวลา</h2>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary Cards */}
      <SummaryCards data={summary} />

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-7 mt-6">
        <BalanceTrendChart data={balanceTrend} />
        <CategoryPieChart data={expensesByCategory} />
      </div>

      {/* Recent Transactions - pass dateRange and account to sync filtering */}
      <div className="mt-6">
        <RecentTransactions
          initialData={initialTransactions}
          categories={categories}
          dateRange={dateRange}
          accountNumber={selectedAccount === 'all' ? undefined : selectedAccount}
          showAccountColumn={selectedAccount === 'all' && accounts.length > 1}
        />
      </div>
    </div>
  )
}
