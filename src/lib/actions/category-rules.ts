'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

/**
 * ข้อมูล Rule สำหรับแสดงผล
 */
export interface RuleData {
  id: string
  categoryId: string
  categoryName: string
  categoryColor: string | null
  field: string
  pattern: string
  isRegex: boolean
  priority: number
  isActive: boolean
}

/**
 * ดึงรายการ rules ทั้งหมด
 */
export async function getRules(): Promise<RuleData[]> {
  const rules = await prisma.categoryRule.findMany({
    include: {
      category: {
        select: {
          name: true,
          color: true,
        },
      },
    },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'desc' },
    ],
  })

  return rules.map((rule) => ({
    id: rule.id,
    categoryId: rule.categoryId,
    categoryName: rule.category.name,
    categoryColor: rule.category.color,
    field: rule.field,
    pattern: rule.pattern,
    isRegex: rule.isRegex,
    priority: rule.priority,
    isActive: rule.isActive,
  }))
}

/**
 * ดึง categories ทั้งหมดสำหรับ dropdown
 */
export async function getCategoriesForSelect(): Promise<{ id: string; name: string; color: string | null }[]> {
  return prisma.category.findMany({
    select: {
      id: true,
      name: true,
      color: true,
    },
    orderBy: { name: 'asc' },
  })
}

/**
 * Input สำหรับสร้าง/แก้ไข rule
 */
export interface RuleInput {
  categoryId: string
  field: 'note' | 'description'
  pattern: string
  isRegex: boolean
  priority: number
  isActive: boolean
}

/**
 * สร้าง rule ใหม่
 */
export async function createRule(input: RuleInput): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate regex if needed
    if (input.isRegex) {
      try {
        new RegExp(input.pattern)
      } catch {
        return { success: false, error: 'รูปแบบ Regex ไม่ถูกต้อง' }
      }
    }

    await prisma.categoryRule.create({
      data: {
        categoryId: input.categoryId,
        field: input.field,
        pattern: input.pattern,
        isRegex: input.isRegex,
        priority: input.priority,
        isActive: input.isActive,
      },
    })

    revalidatePath('/dashboard/rules')
    return { success: true }
  } catch (error) {
    console.error('Create rule error:', error)
    return { success: false, error: 'เกิดข้อผิดพลาดในการสร้าง rule' }
  }
}

/**
 * แก้ไข rule
 */
export async function updateRule(
  id: string,
  input: Partial<RuleInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate regex if needed
    if (input.isRegex && input.pattern) {
      try {
        new RegExp(input.pattern)
      } catch {
        return { success: false, error: 'รูปแบบ Regex ไม่ถูกต้อง' }
      }
    }

    await prisma.categoryRule.update({
      where: { id },
      data: input,
    })

    revalidatePath('/dashboard/rules')
    return { success: true }
  } catch (error) {
    console.error('Update rule error:', error)
    return { success: false, error: 'เกิดข้อผิดพลาดในการแก้ไข rule' }
  }
}

/**
 * ลบ rule
 */
export async function deleteRule(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.categoryRule.delete({
      where: { id },
    })

    revalidatePath('/dashboard/rules')
    return { success: true }
  } catch (error) {
    console.error('Delete rule error:', error)
    return { success: false, error: 'เกิดข้อผิดพลาดในการลบ rule' }
  }
}

/**
 * Toggle สถานะ active/inactive
 */
export async function toggleRuleActive(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const rule = await prisma.categoryRule.findUnique({ where: { id } })
    if (!rule) {
      return { success: false, error: 'ไม่พบ rule' }
    }

    await prisma.categoryRule.update({
      where: { id },
      data: { isActive: !rule.isActive },
    })

    revalidatePath('/dashboard/rules')
    return { success: true }
  } catch (error) {
    console.error('Toggle rule error:', error)
    return { success: false, error: 'เกิดข้อผิดพลาด' }
  }
}

/**
 * ทดสอบ pattern กับข้อความ
 */
export async function testPattern(
  pattern: string,
  isRegex: boolean,
  testText: string
): Promise<{ matches: boolean; error?: string }> {
  try {
    if (isRegex) {
      const regex = new RegExp(pattern, 'i')
      return { matches: regex.test(testText) }
    } else {
      return { matches: testText.toLowerCase().includes(pattern.toLowerCase()) }
    }
  } catch (error) {
    return { matches: false, error: 'รูปแบบ Regex ไม่ถูกต้อง' }
  }
}
