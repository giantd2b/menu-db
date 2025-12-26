'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Learned rules from Excel analysis
const LEARNED_RULES = [
  { category: "ค่าบริการสอบบัญชี", field: "note", pattern: "ค่าสอบบัญชี", priority: 1 },
  { category: "ค่ารถรับส่งพระ", field: "note", pattern: "รับพระ", priority: 1 },
  { category: "ค่าโฆษณา Google Adwords", field: "note", pattern: "google", priority: 1 },
  { category: "เจ้าหนี้เช่าซื้อ", field: "note", pattern: "ค่ารถ", priority: 1 },
  { category: "เจ้าหนี้เช่าซื้อ", field: "description", pattern: "LEASING", priority: 2 },
  { category: "ค่าทางด่วน", field: "note", pattern: "mpass", priority: 1 },
  { category: "ค่าโฆษณา Facebook Ads", field: "note", pattern: "ads", priority: 1 },
  { category: "ค่ารักษาความปลอดภัย", field: "note", pattern: "ค่ารักษาความปลอดภัย", priority: 1 },
  { category: "ค่าบริการคลาวด์เซอร์วิซ", field: "note", pattern: "Humansoft", priority: 1 },
  { category: "เจ้าหนี้สรรพากร", field: "note", pattern: "ค่าภาษี", priority: 1 },
  { category: "เจ้าหนี้สรรพากร", field: "note", pattern: "ภพ.30", priority: 1 },
  { category: "เจ้าหนี้สรรพากร", field: "note", pattern: "ภงด.3", priority: 1 },
  { category: "เงินสมทบประกันสังคม และกองทุนทดแทน", field: "note", pattern: "SSO", priority: 1 },
  { category: "เงินสด", field: "note", pattern: "Petty Cash", priority: 1 },
  { category: "ประกันสังคมค้างจ่าย", field: "note", pattern: "SSO", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "ซื้อสินค้า", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "PO", priority: 1 },
  { category: "ค่าจ้างที่ปรึกษาการตลาด", field: "note", pattern: "ค่าการตลาด", priority: 1 },
  { category: "ค่าจ้างที่ปรึกษาการตลาด", field: "note", pattern: "ที่ปรึกษาการตลาด", priority: 1 },
  { category: "ค่าเช่าอุปกรณ์", field: "note", pattern: "ค่าเช่าเครื่องล้างจาน", priority: 1 },
  { category: "ค่าเช่าอุปกรณ์", field: "note", pattern: "ค่าเช่าเครื่องถ่ายเอกสาร", priority: 1 },
  { category: "ค่าโทรศัพท์สำนักงาน", field: "note", pattern: "ค่าโทรศัพท์", priority: 1 },
  { category: "ค่าโทรศัพท์สำนักงาน", field: "note", pattern: "อินเตอร์เน็ต", priority: 1 },
  { category: "ค่าจ้างพนักงานชั่วคราว", field: "note", pattern: "พาร์ทไทม์", priority: 1 },
  { category: "ค่าจ้างพนักงานชั่วคราว", field: "note", pattern: "เบิกเงินทดรองจ่ายพาร์ท", priority: 1 },
  { category: "ค่าไฟฟ้า", field: "note", pattern: "ค่าไฟ", priority: 1 },
  { category: "เงินเดือน ค่าจ้าง", field: "note", pattern: "เงินเดือน", priority: 1 },
  { category: "เงินเดือน ค่าจ้าง", field: "description", pattern: "Payroll", priority: 2 },
  { category: "ค่าน้ำมัน", field: "note", pattern: "น้ำมัน", priority: 1 },
  { category: "ค่าน้ำมัน", field: "note", pattern: "ออกงาน", priority: 1 },
  { category: "ค่าน้ำมัน", field: "note", pattern: "เซทงาน", priority: 1 },
  { category: "เงินจ่ายล่วงหน้า - เงินมัดจำ", field: "note", pattern: "มัดจำ", priority: 1 },
  { category: "ค่าซ่อมแซม", field: "note", pattern: "ค่าซ่อม", priority: 1 },
  { category: "ค่าซ่อมแซม", field: "note", pattern: "ซ่อมบำรุง", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "ไฟสนาม", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "ภาชนะ", priority: 1 },
  { category: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", field: "note", pattern: "เต๊นท์", priority: 1 },
  { category: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", field: "note", pattern: "โต๊ะ เก้าอี้", priority: 1 },
  { category: "ชำระหนี้-ศิริ", field: "description", pattern: "ศิริ", priority: 2 },
  { category: "ค่าธรรมเนียมธนาคาร", field: "description", pattern: "ค่าธรรมเนียม", priority: 2 },
  { category: "ค่าธรรมเนียมธนาคาร", field: "description", pattern: "Bank Fee", priority: 2 },
  { category: "ภาษีขาย ภ.พ.30", field: "description", pattern: "REVENUE DEPARTMENT", priority: 2 },
  { category: "ค่าบริการอื่นๆ", field: "note", pattern: "GPS", priority: 1 },
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "ค่าเทปูน", priority: 1 },
  { category: "ต้นทุนการก่อสร้าง", field: "description", pattern: "CPAC", priority: 2 },
  { category: "ค่าใช้จ่ายอื่น", field: "note", pattern: "เบิก", priority: 3 },
]

export async function importLearnedRules(): Promise<{
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}> {
  const errors: string[] = []
  let imported = 0
  let skipped = 0

  for (const rule of LEARNED_RULES) {
    try {
      // Find category
      const category = await prisma.category.findUnique({
        where: { name: rule.category },
      })

      if (!category) {
        errors.push(`Category not found: ${rule.category}`)
        skipped++
        continue
      }

      // Check if rule already exists
      const existing = await prisma.categoryRule.findFirst({
        where: {
          categoryId: category.id,
          field: rule.field,
          pattern: rule.pattern,
        },
      })

      if (existing) {
        skipped++
        continue
      }

      // Create rule
      await prisma.categoryRule.create({
        data: {
          categoryId: category.id,
          field: rule.field,
          pattern: rule.pattern,
          isRegex: false,
          priority: rule.priority,
          isActive: true,
        },
      })

      imported++
    } catch (error) {
      errors.push(`Error creating rule for ${rule.category}: ${error}`)
    }
  }

  revalidatePath('/dashboard/rules')

  return { success: true, imported, skipped, errors }
}
