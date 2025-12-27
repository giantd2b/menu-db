import { getTransactionsPaginated, getCategories } from '@/lib/actions/dashboard'
import TransactionsClient from './TransactionsClient'

export const dynamic = 'force-dynamic'

export default async function TransactionsPage() {
  const [paginatedTransactions, categories] = await Promise.all([
    getTransactionsPaginated(1, 50),
    getCategories(),
  ])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4">
        <TransactionsClient
          initialData={paginatedTransactions}
          categories={categories}
        />
      </div>
    </div>
  )
}
