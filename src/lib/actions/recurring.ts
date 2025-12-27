'use server'

import { prisma } from '@/lib/prisma'
import { detectRecurringPatterns, saveDetectedPatterns } from '@/lib/services/recurring-detection'
import { invalidateDashboardCache } from './dashboard'

export interface RecurringPatternData {
  id: string
  name: string
  pattern: string
  field: string
  frequency: string
  expectedDay: number | null
  averageAmount: number
  minAmount: number | null
  maxAmount: number | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  occurrenceCount: number
  lastOccurrence: string | null
  isActive: boolean
  isAutoDetected: boolean
}

/**
 * Get all recurring patterns
 */
export async function getRecurringPatterns(): Promise<RecurringPatternData[]> {
  const patterns = await prisma.recurringPattern.findMany({
    include: {
      category: {
        select: { id: true, name: true, color: true },
      },
    },
    orderBy: [{ isActive: 'desc' }, { occurrenceCount: 'desc' }],
  })

  return patterns.map((p) => ({
    id: p.id,
    name: p.name,
    pattern: p.pattern,
    field: p.field,
    frequency: p.frequency,
    expectedDay: p.expectedDay,
    averageAmount: Number(p.averageAmount),
    minAmount: p.minAmount ? Number(p.minAmount) : null,
    maxAmount: p.maxAmount ? Number(p.maxAmount) : null,
    categoryId: p.categoryId,
    categoryName: p.category?.name || null,
    categoryColor: p.category?.color || null,
    occurrenceCount: p.occurrenceCount,
    lastOccurrence: p.lastOccurrence?.toISOString() || null,
    isActive: p.isActive,
    isAutoDetected: p.isAutoDetected,
  }))
}

/**
 * Run detection and save patterns
 */
export async function runRecurringDetection(): Promise<{
  detected: number
  saved: number
}> {
  const patterns = await detectRecurringPatterns()
  const saved = await saveDetectedPatterns(patterns)

  return {
    detected: patterns.length,
    saved,
  }
}

/**
 * Update a recurring pattern
 */
export async function updateRecurringPattern(
  id: string,
  data: {
    name?: string
    categoryId?: string | null
    isActive?: boolean
  }
): Promise<{ success: boolean }> {
  try {
    await prisma.recurringPattern.update({
      where: { id },
      data,
    })

    await invalidateDashboardCache()

    return { success: true }
  } catch (error) {
    console.error('Update recurring pattern failed:', error)
    return { success: false }
  }
}

/**
 * Delete a recurring pattern
 */
export async function deleteRecurringPattern(id: string): Promise<{ success: boolean }> {
  try {
    await prisma.recurringPattern.delete({
      where: { id },
    })

    return { success: true }
  } catch (error) {
    console.error('Delete recurring pattern failed:', error)
    return { success: false }
  }
}

/**
 * Create a manual recurring pattern
 */
export async function createRecurringPattern(data: {
  name: string
  pattern: string
  field: 'note' | 'description'
  frequency: 'monthly' | 'weekly' | 'yearly'
  expectedDay?: number
  averageAmount: number
  categoryId?: string
}): Promise<{ success: boolean; id?: string }> {
  try {
    const pattern = await prisma.recurringPattern.create({
      data: {
        name: data.name,
        pattern: data.pattern,
        field: data.field,
        frequency: data.frequency,
        expectedDay: data.expectedDay || null,
        averageAmount: data.averageAmount,
        categoryId: data.categoryId || null,
        isAutoDetected: false,
      },
    })

    return { success: true, id: pattern.id }
  } catch (error) {
    console.error('Create recurring pattern failed:', error)
    return { success: false }
  }
}

/**
 * Get recurring summary for dashboard
 */
export async function getRecurringSummary(): Promise<{
  totalPatterns: number
  activePatterns: number
  monthlyEstimate: number
}> {
  const patterns = await prisma.recurringPattern.findMany({
    where: { isActive: true },
    select: {
      frequency: true,
      averageAmount: true,
    },
  })

  let monthlyEstimate = 0
  patterns.forEach((p) => {
    const amount = Number(p.averageAmount)
    switch (p.frequency) {
      case 'weekly':
        monthlyEstimate += amount * 4
        break
      case 'monthly':
        monthlyEstimate += amount
        break
      case 'yearly':
        monthlyEstimate += amount / 12
        break
    }
  })

  return {
    totalPatterns: patterns.length,
    activePatterns: patterns.length,
    monthlyEstimate: Math.round(monthlyEstimate * 100) / 100,
  }
}
