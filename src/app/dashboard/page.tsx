import {
  getSummaryData,
  getBalanceTrend,
  getExpensesByCategory,
  getTransactionsPaginated,
  getCategories,
  getAllAccounts,
  getAllAccountBalances,
} from '@/lib/actions/dashboard'
import { DashboardClient } from '@/components/dashboard'
import ClearDataButton from '@/components/dashboard/ClearDataButton'
import AICategorizeButton from '@/components/dashboard/AICategorizeButton'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [summary, balanceTrend, expensesByCategory, paginatedTransactions, categories, accounts, accountBalances] =
    await Promise.all([
      getSummaryData(),
      getBalanceTrend(),
      getExpensesByCategory(),
      getTransactionsPaginated(1, 20),
      getCategories(),
      getAllAccounts(),
      getAllAccountBalances(),
    ])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              สรุปข้อมูล Bank Statement
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AICategorizeButton />
            <ClearDataButton />
            <Link
              href="/dashboard/transactions"
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
            >
              จัดการ Transactions
            </Link>
            <Link
              href="/dashboard/rules"
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
            >
              จัดการ Rules
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              อัปโหลดไฟล์
            </Link>
          </div>
        </div>

        {/* Dashboard Content with Date Filter */}
        <DashboardClient
          initialSummary={summary}
          initialBalanceTrend={balanceTrend}
          initialExpensesByCategory={expensesByCategory}
          initialTransactions={paginatedTransactions}
          categories={categories}
          accounts={accounts}
          accountBalances={accountBalances}
        />
      </div>
    </div>
  )
}
