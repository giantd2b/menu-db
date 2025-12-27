import { getRecurringPatterns, getRecurringSummary } from '@/lib/actions/recurring'
import { getCategories } from '@/lib/actions/dashboard'
import RecurringClient from './RecurringClient'

export default async function RecurringPage() {
  const [patterns, summary, categories] = await Promise.all([
    getRecurringPatterns(),
    getRecurringSummary(),
    getCategories(),
  ])

  return (
    <RecurringClient
      initialPatterns={patterns}
      initialSummary={summary}
      categories={categories}
    />
  )
}
