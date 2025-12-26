'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Advanced rules based on accuracy analysis - targeting remaining missed patterns
const ADVANCED_RULES = [
  // === ต้นทุนการให้บริการ (597 missed) ===
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "ชะลอม", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "แมคโคร", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "คอฟฟี่", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "เบรค", priority: 2 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "ไปซื้อของ", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "วัตถุดิบ", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "อาหาร", priority: 2 },

  // === ค่าใช้จ่ายอื่น (375 missed) ===
  { category: "ค่าใช้จ่ายอื่น", field: "note", pattern: "GPS", priority: 1 },
  { category: "ค่าใช้จ่ายอื่น", field: "note", pattern: "ค่าบริการ GPS", priority: 1 },
  { category: "ค่าใช้จ่ายอื่น", field: "note", pattern: "ค่าตัดหญ้า", priority: 1 },
  { category: "ค่าใช้จ่ายอื่น", field: "note", pattern: "ดูแลสวน", priority: 1 },
  { category: "ค่าใช้จ่ายอื่น", field: "description", pattern: "REVENUE DEPARTMENT", priority: 1 },
  { category: "ค่าใช้จ่ายอื่น", field: "description", pattern: "CARTRACK", priority: 1 },

  // === เงินเดือน ค่าจ้าง (300 missed) - pattern "XXXเบิก" ===
  { category: "เงินเดือน ค่าจ้าง", field: "note", pattern: "หนุ่ยเบิก", priority: 1 },
  { category: "เงินเดือน ค่าจ้าง", field: "note", pattern: "ต้อยเบิก", priority: 1 },
  { category: "เงินเดือน ค่าจ้าง", field: "note", pattern: "ต้นเบิก", priority: 1 },
  { category: "เงินเดือน ค่าจ้าง", field: "note", pattern: "เบิกไป", priority: 2 },
  { category: "เงินเดือน ค่าจ้าง", field: "description", pattern: "MC2", priority: 2 },

  // === ค่าซ่อมแซม (132 missed) ===
  { category: "ค่าซ่อมแซม", field: "note", pattern: "เปลี่ยนยาง", priority: 1 },
  { category: "ค่าซ่อมแซม", field: "note", pattern: "แป๊บ", priority: 1 },
  { category: "ค่าซ่อมแซม", field: "note", pattern: "เสาเพิ่ม", priority: 1 },
  { category: "ค่าซ่อมแซม", field: "description", pattern: "RUNG STELL", priority: 2 },

  // === ค่าน้ำมัน (125 missed) - vehicle patterns ===
  { category: "ค่าน้ำมัน", field: "note", pattern: "ส่งเต้น", priority: 1 },
  { category: "ค่าน้ำมัน", field: "note", pattern: "รับพระ", priority: 1 },
  { category: "ค่าน้ำมัน", field: "note", pattern: "รัพระ", priority: 1 },
  { category: "ค่าน้ำมัน", field: "note", pattern: "H1", priority: 2 },

  // === อุปกรณ์ของใช้งานจัดเลี้ยง (113 missed) ===
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "ไฟสนาม", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "แก้วไวน์", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "ผ้าโซล่อน", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "โถกดน้ำ", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "จานช้อน", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "ถ้วย", priority: 2 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "ผ้าปู", priority: 2 },

  // === ค่าสวัสดิการอื่นๆ (113 missed) ===
  { category: "ค่าสวัสดิการอื่นๆ", field: "note", pattern: "ค่าห้อง", priority: 1 },
  { category: "ค่าสวัสดิการอื่นๆ", field: "note", pattern: "อั่งเปา", priority: 1 },
  { category: "ค่าสวัสดิการอื่นๆ", field: "note", pattern: "ค่าเรียน", priority: 1 },
  { category: "ค่าสวัสดิการอื่นๆ", field: "note", pattern: "ผ้ากันเปื้อน", priority: 1 },

  // === สินทรัพย์ไม่หมุนเวียนอื่น (108 missed) ===
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "note", pattern: "ถังน้ำ", priority: 1 },
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "note", pattern: "ปั๊มน้ำ", priority: 1 },
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "note", pattern: "เต้นพับ", priority: 1 },
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "note", pattern: "หม้อไฟฟ้า", priority: 1 },
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "note", pattern: "เงินดาวน์", priority: 1 },
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "description", pattern: "อีซูซุ", priority: 2 },

  // === ต้นทุนการก่อสร้าง (97 missed) ===
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "ทินเนอร์", priority: 1 },
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "เหล็กหลังคา", priority: 1 },
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "เหล็กผนัง", priority: 1 },
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "ปูน", priority: 2 },
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "เหล็กสร้าง", priority: 1 },
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "โครงเหล็ก", priority: 1 },
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "โกดัง", priority: 1 },

  // === ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้ (82 missed) ===
  { category: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", field: "note", pattern: "ค่าเต้นท์", priority: 1 },
  { category: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", field: "note", pattern: "เต็นท์งาน", priority: 1 },
  { category: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", field: "note", pattern: "เต้นท์เล็ก", priority: 1 },
  { category: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", field: "note", pattern: "ผ้าใบ", priority: 2 },
  { category: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", field: "description", pattern: "P.R.N PROMOTION", priority: 1 },

  // === ค่าใช้จ่ายส่วนตัว-ศิริ (77 missed) ===
  { category: "ค่าใช้จ่ายส่วนตัว-ศิริ", field: "note", pattern: "cash plus", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ศิริ", field: "note", pattern: "uob", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ศิริ", field: "description", pattern: "CIMB THAI AUTO", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ศิริ", field: "description", pattern: "เกษร เกตุประสาท", priority: 1 },

  // === ค่าใช้จ่ายส่วนตัว-ภูมิ (74 missed) ===
  { category: "ค่าใช้จ่ายส่วนตัว-ภูมิ", field: "note", pattern: "โอนแม่ภูมิ", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ภูมิ", field: "description", pattern: "SUJIRA KAEWON", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ภูมิ", field: "description", pattern: "DENTAL SELECT", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ภูมิ", field: "description", pattern: "SUPORNTIP KEAW", priority: 1 },

  // === อุปกรณ์ของใช้งานจัดเลี้ยง-FB (60 missed) ===
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "ลายคราม", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "ผ้าปู 1.8", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "โต๊ะเหลี่ยม", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "ชุดเต้นท์พับ", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "เหล็กอุปกรณ์", priority: 1 },

  // === อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง (59 missed) ===
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", field: "note", pattern: "อุปกรณ์network", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", field: "note", pattern: "กระดาษทราย", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", field: "note", pattern: "CNC", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", field: "note", pattern: "เครื่องเสียง", priority: 1 },

  // === ค่าจ้างพนักงานชั่วคราว (54 missed) ===
  { category: "ค่าจ้างพนักงานชั่วคราว", field: "note", pattern: "เบิกส่วนต่าง", priority: 1 },
  { category: "ค่าจ้างพนักงานชั่วคราว", field: "note", pattern: "เบิกทดลองจ่าย", priority: 1 },
  { category: "ค่าจ้างพนักงานชั่วคราว", field: "note", pattern: "ค่ารีวิว", priority: 1 },

  // === ค่าจ้างบริการเว็บไซต์ (39 missed) ===
  { category: "ค่าจ้างบริการเว็บไซต์", field: "note", pattern: "E-Tax", priority: 1 },
  { category: "ค่าจ้างบริการเว็บไซต์", field: "note", pattern: "โปรแกรม Peak", priority: 1 },
  { category: "ค่าจ้างบริการเว็บไซต์", field: "note", pattern: "Leceipt", priority: 1 },
  { category: "ค่าจ้างบริการเว็บไซต์", field: "description", pattern: "ฟรีเวชั่น", priority: 1 },
  { category: "ค่าจ้างบริการเว็บไซต์", field: "description", pattern: "พี ยู ยู เอ็น", priority: 1 },

  // === เงินปันผล (39 missed) ===
  { category: "เงินปันผล", field: "note", pattern: "ปันผล", priority: 1 },
  { category: "เงินปันผล", field: "note", pattern: "จ่ายหนี้", priority: 2 },
  { category: "เงินปันผล", field: "note", pattern: "คุณฝน", priority: 1 },
  { category: "เงินปันผล", field: "description", pattern: "NAMFON WONGSUWA", priority: 1 },

  // === วัสดุสิ้นเปลืองงานแต่ง (37 missed) ===
  { category: "วัสดุสิ้นเปลืองงานแต่ง-ค่าใช้จ่ายงานแต่ง", field: "note", pattern: "พิธีกร", priority: 1 },
  { category: "วัสดุสิ้นเปลืองงานแต่ง-ค่าใช้จ่ายงานแต่ง", field: "note", pattern: "ไม้อัด", priority: 1 },
  { category: "วัสดุสิ้นเปลืองงานแต่ง-ค่าใช้จ่ายงานแต่ง", field: "note", pattern: "ป้ายโฟม", priority: 1 },
  { category: "วัสดุสิ้นเปลืองงานแต่ง-ค่าใช้จ่ายงานแต่ง", field: "note", pattern: "งานบวช", priority: 1 },

  // === ค่าธรรมเนียมธนาคาร (33 missed) ===
  { category: "ค่าธรรมเนียมธนาคาร", field: "description", pattern: "PromptPay fee", priority: 1 },
  { category: "ค่าธรรมเนียมธนาคาร", field: "description", pattern: "Transfer fee", priority: 1 },
  { category: "ค่าธรรมเนียมธนาคาร", field: "description", pattern: "DEPARTMENT OF BUSINESS", priority: 1 },

  // === ค่าเช่าสำนักงาน (30 missed) ===
  { category: "ค่าเช่าสำนักงาน", field: "note", pattern: "เช่าที่ดิน", priority: 1 },
  { category: "ค่าเช่าสำนักงาน", field: "note", pattern: "ค่าเต่าตึก", priority: 1 },
  { category: "ค่าเช่าสำนักงาน", field: "description", pattern: "SUTHEP SETBUNSA", priority: 1 },
]

export async function importAdvancedRules(): Promise<{
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}> {
  const errors: string[] = []
  let imported = 0
  let skipped = 0

  for (const rule of ADVANCED_RULES) {
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
