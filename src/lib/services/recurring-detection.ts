import { prisma } from '@/lib/prisma'

interface TransactionGroup {
  pattern: string
  field: 'note' | 'description'
  transactions: Array<{
    id: string
    date: Date
    amount: number
    note: string | null
    description: string
  }>
}

interface DetectedPattern {
  name: string
  pattern: string
  field: 'note' | 'description'
  frequency: 'monthly' | 'weekly' | 'yearly'
  expectedDay: number | null
  averageAmount: number
  minAmount: number
  maxAmount: number
  occurrenceCount: number
  lastOccurrence: Date
  categoryId: string | null
}

/**
 * Normalize text for pattern matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\d+/g, '') // Remove numbers
    .replace(/[^\u0E00-\u0E7Fa-z\s]/g, '') // Keep Thai and English letters
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Calculate the most common day of month
 */
function getMostCommonDay(dates: Date[]): number | null {
  if (dates.length < 2) return null

  const dayCounts: Record<number, number> = {}
  dates.forEach((d) => {
    const day = d.getDate()
    dayCounts[day] = (dayCounts[day] || 0) + 1
  })

  let maxCount = 0
  let mostCommonDay = 0
  Object.entries(dayCounts).forEach(([day, count]) => {
    if (count > maxCount) {
      maxCount = count
      mostCommonDay = parseInt(day)
    }
  })

  // Only return if appears in at least 30% of occurrences
  return maxCount >= dates.length * 0.3 ? mostCommonDay : null
}

/**
 * Determine frequency based on intervals between transactions
 */
function determineFrequency(dates: Date[]): 'monthly' | 'weekly' | 'yearly' | null {
  if (dates.length < 3) return null

  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const intervals: number[] = []

  for (let i = 1; i < sortedDates.length; i++) {
    const diffDays = Math.round(
      (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
    )
    intervals.push(diffDays)
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length

  // Weekly: 5-10 days apart
  if (avgInterval >= 5 && avgInterval <= 10) return 'weekly'

  // Monthly: 25-35 days apart
  if (avgInterval >= 25 && avgInterval <= 35) return 'monthly'

  // Yearly: 350-380 days apart
  if (avgInterval >= 350 && avgInterval <= 380) return 'yearly'

  // Default to monthly if in reasonable range
  if (avgInterval >= 15 && avgInterval <= 45) return 'monthly'

  return null
}

/**
 * Detect recurring patterns from transactions
 */
export async function detectRecurringPatterns(): Promise<DetectedPattern[]> {
  // Get all withdrawal transactions
  const transactions = await prisma.transaction.findMany({
    where: {
      withdrawal: { not: null },
    },
    select: {
      id: true,
      date: true,
      withdrawal: true,
      note: true,
      description: true,
      rawDescription: true,
      categoryId: true,
    },
    orderBy: { date: 'asc' },
  })

  // Group transactions by normalized pattern
  const noteGroups: Map<string, TransactionGroup> = new Map()
  const descGroups: Map<string, TransactionGroup> = new Map()

  transactions.forEach((tx) => {
    const amount = Number(tx.withdrawal)

    // Group by note
    if (tx.note) {
      const normalizedNote = normalizeText(tx.note)
      if (normalizedNote.length >= 3) {
        const existing = noteGroups.get(normalizedNote) || {
          pattern: tx.note,
          field: 'note' as const,
          transactions: [],
        }
        existing.transactions.push({
          id: tx.id,
          date: tx.date,
          amount,
          note: tx.note,
          description: tx.description,
        })
        noteGroups.set(normalizedNote, existing)
      }
    }

    // Group by description
    if (tx.rawDescription) {
      const normalizedDesc = normalizeText(tx.rawDescription)
      if (normalizedDesc.length >= 3) {
        const existing = descGroups.get(normalizedDesc) || {
          pattern: tx.rawDescription,
          field: 'description' as const,
          transactions: [],
        }
        existing.transactions.push({
          id: tx.id,
          date: tx.date,
          amount,
          note: tx.note,
          description: tx.rawDescription,
        })
        descGroups.set(normalizedDesc, existing)
      }
    }
  })

  const detectedPatterns: DetectedPattern[] = []

  // Analyze groups and detect recurring patterns
  const allGroups = [...noteGroups.values(), ...descGroups.values()]

  for (const group of allGroups) {
    // Need at least 3 occurrences
    if (group.transactions.length < 3) continue

    const dates = group.transactions.map((t) => t.date)
    const amounts = group.transactions.map((t) => t.amount)

    // Determine frequency
    const frequency = determineFrequency(dates)
    if (!frequency) continue

    // Calculate amount statistics
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const minAmount = Math.min(...amounts)
    const maxAmount = Math.max(...amounts)

    // Check if amounts are reasonably consistent (max variation 50%)
    const amountVariation = (maxAmount - minAmount) / avgAmount
    if (amountVariation > 0.5) continue

    // Get expected day
    const expectedDay = getMostCommonDay(dates)

    // Get category from most recent transaction with category
    const lastWithCategory = group.transactions
      .reverse()
      .find((t) => {
        const tx = transactions.find((tr) => tr.id === t.id)
        return tx?.categoryId
      })
    const categoryId = lastWithCategory
      ? transactions.find((tr) => tr.id === lastWithCategory.id)?.categoryId || null
      : null

    detectedPatterns.push({
      name: group.pattern.slice(0, 50),
      pattern: group.pattern,
      field: group.field,
      frequency,
      expectedDay,
      averageAmount: Math.round(avgAmount * 100) / 100,
      minAmount,
      maxAmount,
      occurrenceCount: group.transactions.length,
      lastOccurrence: dates[dates.length - 1],
      categoryId,
    })
  }

  // Sort by occurrence count
  detectedPatterns.sort((a, b) => b.occurrenceCount - a.occurrenceCount)

  return detectedPatterns
}

/**
 * Save detected patterns to database
 */
export async function saveDetectedPatterns(patterns: DetectedPattern[]): Promise<number> {
  let savedCount = 0

  for (const pattern of patterns) {
    // Check if pattern already exists
    const existing = await prisma.recurringPattern.findFirst({
      where: {
        pattern: pattern.pattern,
        field: pattern.field,
      },
    })

    if (existing) {
      // Update existing pattern
      await prisma.recurringPattern.update({
        where: { id: existing.id },
        data: {
          averageAmount: pattern.averageAmount,
          minAmount: pattern.minAmount,
          maxAmount: pattern.maxAmount,
          occurrenceCount: pattern.occurrenceCount,
          lastOccurrence: pattern.lastOccurrence,
          categoryId: pattern.categoryId,
        },
      })
    } else {
      // Create new pattern
      await prisma.recurringPattern.create({
        data: {
          name: pattern.name,
          pattern: pattern.pattern,
          field: pattern.field,
          frequency: pattern.frequency,
          expectedDay: pattern.expectedDay,
          averageAmount: pattern.averageAmount,
          minAmount: pattern.minAmount,
          maxAmount: pattern.maxAmount,
          occurrenceCount: pattern.occurrenceCount,
          lastOccurrence: pattern.lastOccurrence,
          categoryId: pattern.categoryId,
          isAutoDetected: true,
        },
      })
      savedCount++
    }
  }

  return savedCount
}
