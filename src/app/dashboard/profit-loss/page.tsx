import { getPnLSummary, getAvailablePeriods, type PeriodOption } from '@/lib/actions/profit-loss'
import { getCategories, getAllAccounts } from '@/lib/actions/dashboard'
import ProfitLossClient from './ProfitLossClient'

export const dynamic = 'force-dynamic'

export default async function ProfitLossPage() {
  // Default to current month
  const now = new Date()
  const defaultPeriod: PeriodOption = {
    type: 'monthly',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  }

  const [pnlSummary, availablePeriods, categories, accounts] = await Promise.all([
    getPnLSummary(defaultPeriod),
    getAvailablePeriods(),
    getCategories(),
    getAllAccounts(),
  ])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4">
        <ProfitLossClient
          initialSummary={pnlSummary}
          availablePeriods={availablePeriods}
          categories={categories}
          accounts={accounts}
          defaultPeriod={defaultPeriod}
        />
      </div>
    </div>
  )
}
