'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Categories from Excel file (76 categories)
const EXCEL_CATEGORIES = [
  { name: "ต้นทุนการให้บริการ", color: "#ef4444" },
  { name: "ค่ารถรับส่งพระ", color: "#f97316" },
  { name: "ค่าจ้างพนักงานชั่วคราว", color: "#f59e0b" },
  { name: "ค่าใช้จ่ายอื่น", color: "#eab308" },
  { name: "ค่าน้ำมัน", color: "#84cc16" },
  { name: "เงินเดือน ค่าจ้าง", color: "#22c55e" },
  { name: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", color: "#10b981" },
  { name: "เจ้าหนี้เช่าซื้อ", color: "#14b8a6" },
  { name: "ต้นทุนการก่อสร้าง", color: "#06b6d4" },
  { name: "ค่าใช้จ่ายส่วนตัว-ภูมิ", color: "#0ea5e9" },
  { name: "ค่าสวัสดิการอื่นๆ", color: "#3b82f6" },
  { name: "ค่าซ่อมแซม", color: "#6366f1" },
  { name: "อุปกรณ์ของใช้งานจัดเลี้ยง", color: "#8b5cf6" },
  { name: "สินทรัพย์ไม่หมุนเวียนอื่น", color: "#a855f7" },
  { name: "ค่าใช้จ่ายส่วนตัว-ศิริ", color: "#d946ef" },
  { name: "ชำระหนี้-ศิริ", color: "#ec4899" },
  { name: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", color: "#f43f5e" },
  { name: "ค่าเช่าอุปกรณ์", color: "#64748b" },
  { name: "ชำระหนี้-ภูมิ", color: "#78716c" },
  { name: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", color: "#71717a" },
  { name: "ค่าเช่าสำนักงาน", color: "#dc2626" },
  { name: "ค่าโฆษณา Google Adwords", color: "#ea580c" },
  { name: "วัสดุสิ้นเปลืองงานแต่ง-ค่าใช้จ่ายงานแต่ง", color: "#d97706" },
  { name: "ค่าจ้างบริการเว็บไซต์", color: "#ca8a04" },
  { name: "เจ้าหนี้สรรพากร", color: "#65a30d" },
  { name: "ค่าโฆษณา Facebook Ads", color: "#16a34a" },
  { name: "เงินปันผล", color: "#059669" },
  { name: "เงินจ่ายล่วงหน้า - เงินมัดจำ", color: "#0d9488" },
  { name: "ค่าธรรมเนียมธนาคาร", color: "#0891b2" },
  { name: "ค่าโทรศัพท์สำนักงาน", color: "#0284c7" },
  { name: "ค่าตวจสอบสภาพรถและภาษียานภาหนะ", color: "#2563eb" },
  { name: "ค่าไฟฟ้า", color: "#4f46e5" },
  { name: "ค่าบริการอื่นๆ", color: "#7c3aed" },
  { name: "ประกันสังคมค้างจ่าย", color: "#9333ea" },
  { name: "อุปกรณ์ของใช้งานจัดเลี้ยง-ครัว", color: "#c026d3" },
  { name: "ค่าจ้างที่ปรึกษาการตลาด", color: "#db2777" },
  { name: "ค่าทางด่วน", color: "#e11d48" },
  { name: "ค่าขนส่งสินค้า", color: "#475569" },
  { name: "ค่ารักษาความปลอดภัย", color: "#57534e" },
  { name: "ค่าเช่ายานพาหนะ", color: "#52525b" },
  { name: "เงินสมทบประกันสังคม และกองทุนทดแทน", color: "#b91c1c" },
  { name: "ค่าธรรมเนียมอื่นๆ", color: "#c2410c" },
  { name: "เงินสด", color: "#b45309" },
  { name: "เงินเดือนค้างจ่าย", color: "#a16207" },
  { name: "ค่าบริการโฮสติ้ง และเว็บไซต์", color: "#4d7c0f" },
  { name: "ค่าโฆษณาออนไลน์อื่น", color: "#15803d" },
  { name: "ค่าตอบแทนกรรมการ", color: "#047857" },
  { name: "ค่าอบรม สัมมนา", color: "#0f766e" },
  { name: "ภาษีขาย ภ.พ.30", color: "#0e7490" },
  { name: "ภาษีถูกหัก ณ ที่จ่าย", color: "#0369a1" },
  { name: "ค่าส่งเสริมการขาย", color: "#1d4ed8" },
  { name: "ค่าบริการคลาวด์เซอร์วิซ", color: "#4338ca" },
  { name: "สำรองจ่ายแทนกิจการที่ยังไม่ได้คืนเงิน - ภูมิ", color: "#6d28d9" },
  { name: "ค่าอุปกรณ์และเครื่องใช้สำนักงาน", color: "#7e22ce" },
  { name: "ค่าบริการสอบบัญชี", color: "#a21caf" },
  { name: "ค่าสวัสดิการอาหาร เครื่องดื่ม", color: "#be185d" },
  { name: "อุปกรณ์ของใช้งานจัดเลี้ยง-Back-office", color: "#be123c" },
  { name: "ค่ารักษาความสะอาด", color: "#334155" },
  { name: "ค่าโฆษณาอื่นๆ", color: "#44403c" },
  { name: "ภาษีเงินได้", color: "#3f3f46" },
  { name: "ภาษีโรงเรือนและสิ่งปลูกสร้าง", color: "#991b1b" },
  { name: "เงินรับล่วงหน้า - เงินมัดจำ", color: "#9a3412" },
  { name: "ค่าเบี้ยเลี้ยงเดินทาง", color: "#92400e" },
  { name: "ค่าบริการบัญชี", color: "#854d0e" },
  { name: "เจ้าหนี้-ค่างวดรถ ยจ6170", color: "#3f6212" },
  { name: "เจ้าหนี้-ค่างวดรถ 2ฒฬ1816", color: "#166534" },
  { name: "เจ้าหนี้-ค่างวดรถ ยจ9612", color: "#115e59" },
  { name: "วัสดุสิ้นเปลืองงานแต่ง", color: "#155e75" },
  { name: "อุปกรณ์ของใช้งานจัดเลี้ยง-งานแต่ง", color: "#075985" },
  { name: "ภาษีบำรุงท้องที่", color: "#1e40af" },
  { name: "เงินลงทุนในบริษัทย่อย", color: "#3730a3" },
  { name: "โบนัส", color: "#5b21b6" },
  { name: "เงินลงทุนเผื่อขาย", color: "#6b21a8" },
  { name: "ค่าจ้างผลิตสื่อโฆษณา", color: "#86198f" },
  { name: "ค่าประปา", color: "#9d174d" },
  { name: "ภาษีเงินได้ค้างจ่าย", color: "#9f1239" },
  // Default fallback
  { name: "ไม่ระบุ", color: "#94a3b8" },
]

/**
 * Sync categories from Excel to database
 * - Creates new categories if not exist
 * - Updates color if category exists
 */
export async function syncCategoriesFromExcel(): Promise<{
  success: boolean
  created: number
  updated: number
  error?: string
}> {
  try {
    let created = 0
    let updated = 0

    for (const cat of EXCEL_CATEGORIES) {
      const existing = await prisma.category.findUnique({
        where: { name: cat.name },
      })

      if (existing) {
        // Update color if different
        if (existing.color !== cat.color) {
          await prisma.category.update({
            where: { id: existing.id },
            data: { color: cat.color },
          })
          updated++
        }
      } else {
        // Create new
        await prisma.category.create({
          data: {
            name: cat.name,
            color: cat.color,
          },
        })
        created++
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/rules')

    return { success: true, created, updated }
  } catch (error) {
    console.error('Sync categories error:', error)
    return {
      success: false,
      created: 0,
      updated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get all categories
 */
export async function getAllCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { transactions: true },
      },
    },
  })
}

/**
 * Delete unused categories (no transactions)
 */
export async function deleteUnusedCategories(): Promise<{ deleted: number }> {
  const result = await prisma.category.deleteMany({
    where: {
      transactions: { none: {} },
      NOT: { name: 'ไม่ระบุ' }, // Keep default
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/rules')

  return { deleted: result.count }
}
