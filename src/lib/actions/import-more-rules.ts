'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Additional rules based on analysis
const MORE_RULES = [
  // ต้นทุนการให้บริการ - เพิ่ม patterns
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "ร้าน", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "ซีฟู้ด", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "กุ้ง", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "เพิ่ม", priority: 2 },

  // ค่าน้ำมัน - patterns ใหม่
  { category: "ค่าน้ำมัน", field: "note", pattern: "เซทงาน", priority: 1 },
  { category: "ค่าน้ำมัน", field: "note", pattern: "เซ็ทงาน", priority: 1 },
  { category: "ค่าน้ำมัน", field: "note", pattern: "isuzu", priority: 2 },
  { category: "ค่าน้ำมัน", field: "note", pattern: "กทม", priority: 2 },

  // ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้
  { category: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", field: "note", pattern: "เช่าโต๊ะเก้าอี้", priority: 1 },
  { category: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", field: "note", pattern: "โต๊ะเก้าอี้", priority: 1 },

  // ต้นทุนการก่อสร้าง
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "ค่าเทปูน", priority: 1 },
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "อุปกรณ์ช่าง", priority: 1 },
  { category: "ต้นทุนการก่อสร้าง", field: "description", pattern: "CPAC", priority: 2 },

  // ค่าเช่าสำนักงาน
  { category: "ค่าเช่าสำนักงาน", field: "note", pattern: "ค่าเช่า", priority: 2 },
  { category: "ค่าเช่าสำนักงาน", field: "note", pattern: "ค่าเช่าร้าน", priority: 1 },

  // ค่าเช่าอุปกรณ์ - เพิ่ม
  { category: "ค่าเช่าอุปกรณ์", field: "note", pattern: "แท่นพระ", priority: 1 },
  { category: "ค่าเช่าอุปกรณ์", field: "note", pattern: "โพเดี๊ยม", priority: 1 },

  // ค่าใช้จ่ายส่วนตัว-ภูมิ
  { category: "ค่าใช้จ่ายส่วนตัว-ภูมิ", field: "note", pattern: "uob", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ภูมิ", field: "note", pattern: "first choice", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ภูมิ", field: "note", pattern: "true money", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ภูมิ", field: "description", pattern: "POOM KAEWON", priority: 2 },

  // ค่าใช้จ่ายส่วนตัว-ศิริ
  { category: "ค่าใช้จ่ายส่วนตัว-ศิริ", field: "note", pattern: "shopee", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ศิริ", field: "note", pattern: "honda", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ศิริ", field: "description", pattern: "SIRI KETPRASAT", priority: 2 },
  { category: "ค่าใช้จ่ายส่วนตัว-ศิริ", field: "description", pattern: "ศิริ เกตุประสาท", priority: 2 },

  // ชำระหนี้-ภูมิ
  { category: "ชำระหนี้-ภูมิ", field: "note", pattern: "finnix", priority: 1 },
  { category: "ชำระหนี้-ภูมิ", field: "note", pattern: "scb loan", priority: 1 },
  { category: "ชำระหนี้-ภูมิ", field: "description", pattern: "ภูมิ แก้วอ่อน", priority: 2 },

  // ชำระหนี้-ศิริ
  { category: "ชำระหนี้-ศิริ", field: "note", pattern: "พฤกษา", priority: 1 },
  { category: "ชำระหนี้-ศิริ", field: "note", pattern: "พัทยาลากูน", priority: 1 },
  { category: "ชำระหนี้-ศิริ", field: "note", pattern: "maxus", priority: 1 },

  // ค่าสวัสดิการอื่นๆ
  { category: "ค่าสวัสดิการอื่นๆ", field: "note", pattern: "ค่าตรวจร่างกาย", priority: 1 },
  { category: "ค่าสวัสดิการอื่นๆ", field: "note", pattern: "ค่าเสื้อ", priority: 1 },
  { category: "ค่าสวัสดิการอื่นๆ", field: "note", pattern: "ค่านิมนต์พระ", priority: 1 },

  // อุปกรณ์ของใช้งานจัดเลี้ยง
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "ภาชนะพระ", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "พรม", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "ปลอกเก้าอี้", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "ซื้อทรัพสิน", priority: 1 },

  // อุปกรณ์ของใช้งานจัดเลี้ยง-FB
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "warmer", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "อาสนะ", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "แผนกFB", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "FB", priority: 2 },

  // อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", field: "note", pattern: "ลำโพง", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", field: "note", pattern: "แอมป์", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", field: "note", pattern: "network", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", field: "note", pattern: "อุปกรณ์ไฟฟ้า", priority: 1 },

  // สินทรัพย์ไม่หมุนเวียนอื่น
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "note", pattern: "เก้าอี้มังกร", priority: 1 },
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "note", pattern: "ค่าดาวน์", priority: 1 },
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "note", pattern: "ซื้อตู้", priority: 1 },

  // วัสดุสิ้นเปลืองงานแต่ง
  { category: "วัสดุสิ้นเปลืองงานแต่ง-ค่าใช้จ่ายงานแต่ง", field: "note", pattern: "นายพิธี", priority: 1 },
  { category: "วัสดุสิ้นเปลืองงานแต่ง-ค่าใช้จ่ายงานแต่ง", field: "note", pattern: "ป้ายไวนิล", priority: 1 },
  { category: "วัสดุสิ้นเปลืองงานแต่ง-ค่าใช้จ่ายงานแต่ง", field: "note", pattern: "งานแต่ง", priority: 1 },
  { category: "วัสดุสิ้นเปลืองงานแต่ง-ค่าใช้จ่ายงานแต่ง", field: "note", pattern: "ฉากงานแต่ง", priority: 1 },

  // ค่าจ้างพนักงานชั่วคราว - เพิ่ม
  { category: "ค่าจ้างพนักงานชั่วคราว", field: "note", pattern: "ค่ามัคทายก", priority: 1 },
  { category: "ค่าจ้างพนักงานชั่วคราว", field: "note", pattern: "ค่าแรง", priority: 1 },
  { category: "ค่าจ้างพนักงานชั่วคราว", field: "note", pattern: "เบิกทดรองจ่าย", priority: 1 },

  // เงินเดือน ค่าจ้าง - เพิ่ม
  { category: "เงินเดือน ค่าจ้าง", field: "note", pattern: "เบิก", priority: 3 },
  { category: "เงินเดือน ค่าจ้าง", field: "description", pattern: "PAY PEAK", priority: 1 },

  // ค่าซ่อมแซม - เพิ่ม
  { category: "ค่าซ่อมแซม", field: "note", pattern: "สีทา", priority: 1 },
  { category: "ค่าซ่อมแซม", field: "note", pattern: "ยางอะไหล่", priority: 1 },
  { category: "ค่าซ่อมแซม", field: "note", pattern: "ฝ้า", priority: 2 },

  // ค่าใช้จ่ายอื่น
  { category: "ค่าใช้จ่ายอื่น", field: "note", pattern: "ค่าตู้แดง", priority: 1 },
  { category: "ค่าใช้จ่ายอื่น", field: "note", pattern: "ค่าปรับ", priority: 1 },
  { category: "ค่าใช้จ่ายอื่น", field: "note", pattern: "คืนหัก", priority: 1 },
]

export async function importMoreRules(): Promise<{
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}> {
  const errors: string[] = []
  let imported = 0
  let skipped = 0

  for (const rule of MORE_RULES) {
    try {
      const category = await prisma.category.findUnique({
        where: { name: rule.category },
      })

      if (!category) {
        errors.push(`Category not found: ${rule.category}`)
        skipped++
        continue
      }

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
      errors.push(`Error: ${rule.category} - ${error}`)
    }
  }

  revalidatePath('/dashboard/rules')

  return { success: true, imported, skipped, errors }
}
