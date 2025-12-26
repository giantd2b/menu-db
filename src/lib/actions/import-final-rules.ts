'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Final rules based on latest accuracy analysis - targeting remaining patterns
const FINAL_RULES = [
  // === ต้นทุนการให้บริการ (411 missed) ===
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "ค่าน้ำแข็ง", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "ค่าแก๊ส", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "ค่าไก่", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "ค่าหมู", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "ค่าเนื้อ", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "ค่าผัก", priority: 1 },
  { category: "ต้นทุนการให้บริการ", field: "note", pattern: "เดือน", priority: 3 },

  // === ค่าใช้จ่ายอื่น (264 missed) ===
  { category: "ค่าใช้จ่ายอื่น", field: "note", pattern: "ตู้แดง", priority: 1 },
  { category: "ค่าใช้จ่ายอื่น", field: "note", pattern: "รถสไลด์", priority: 1 },
  { category: "ค่าใช้จ่ายอื่น", field: "note", pattern: "ค่าที่วาง", priority: 1 },
  { category: "ค่าใช้จ่ายอื่น", field: "note", pattern: "หักณที่จ่าย", priority: 1 },

  // === เงินเดือน ค่าจ้าง (135 missed) ===
  { category: "เงินเดือน ค่าจ้าง", field: "note", pattern: "ยืม", priority: 2 },
  { category: "เงินเดือน ค่าจ้าง", field: "description", pattern: "PAY Incentive", priority: 1 },
  { category: "เงินเดือน ค่าจ้าง", field: "note", pattern: "ซ่อมแซมบ้าน", priority: 2 },

  // === ค่าน้ำมัน (107 missed) - vehicle plate patterns ===
  { category: "ค่าน้ำมัน", field: "note", pattern: "เซตงาน", priority: 1 },
  { category: "ค่าน้ำมัน", field: "note", pattern: "โต๊ะจีน", priority: 2 },
  { category: "ค่าน้ำมัน", field: "note", pattern: "ชลบุรี", priority: 3 },

  // === ค่าซ่อมแซม (99 missed) ===
  { category: "ค่าซ่อมแซม", field: "note", pattern: "ซ่อมคอม", priority: 1 },
  { category: "ค่าซ่อมแซม", field: "note", pattern: "อุปกรณ์ งานไม้", priority: 1 },
  { category: "ค่าซ่อมแซม", field: "note", pattern: "ยางรถ", priority: 1 },
  { category: "ค่าซ่อมแซม", field: "description", pattern: "ซันคอมพิวเตอร์", priority: 2 },

  // === ค่าสวัสดิการอื่นๆ (85 missed) ===
  { category: "ค่าสวัสดิการอื่นๆ", field: "note", pattern: "ยูนิฟอร์ม", priority: 1 },
  { category: "ค่าสวัสดิการอื่นๆ", field: "note", pattern: "work ต่างด้าว", priority: 1 },
  { category: "ค่าสวัสดิการอื่นๆ", field: "note", pattern: "staff outing", priority: 1 },
  { category: "ค่าสวัสดิการอื่นๆ", field: "note", pattern: "ค่าที่พัก", priority: 1 },

  // === อุปกรณ์ของใช้งานจัดเลี้ยง (80 missed) ===
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "อุปกรณ์ครัว", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "ทัพพี", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "กระบวย", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "รถเข็น", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง", field: "note", pattern: "ถาดอะลู", priority: 1 },

  // === สินทรัพย์ไม่หมุนเวียนอื่น (79 missed) ===
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "note", pattern: "โปรแกรมบัญชี", priority: 1 },
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "note", pattern: "กระเบื้อง", priority: 2 },
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "note", pattern: "เวทีสำเร็จรูป", priority: 1 },
  { category: "สินทรัพย์ไม่หมุนเวียนอื่น", field: "note", pattern: "โต๊ะทำงาน", priority: 1 },

  // === ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้ (65 missed) ===
  { category: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", field: "note", pattern: "ค่าเต็นท์", priority: 1 },
  { category: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", field: "note", pattern: "เต็นท์ งาน", priority: 1 },
  { category: "ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้", field: "note", pattern: "หลัง", priority: 3 },

  // === ต้นทุนการก่อสร้าง (57 missed) ===
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "สำรวจไฟฟ้า", priority: 1 },
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "หลังคา", priority: 1 },
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "รางน้ำ", priority: 1 },
  { category: "ต้นทุนการก่อสร้าง", field: "note", pattern: "เหล็ก", priority: 2 },

  // === ค่าใช้จ่ายส่วนตัว-ศิริ (42 missed) ===
  { category: "ค่าใช้จ่ายส่วนตัว-ศิริ", field: "note", pattern: "ประกันชั้น", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ศิริ", field: "note", pattern: "รถชน", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ศิริ", field: "note", pattern: "ดูแลสระน้ำ", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ศิริ", field: "note", pattern: "ยายแดง", priority: 1 },

  // === อุปกรณ์ของใช้งานจัดเลี้ยง-FB (41 missed) ===
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "อุปกรณ์สงฆ์", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "เหยือกสแตนเลส", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "กระติกน้ำแข็ง", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-FB", field: "note", pattern: "ลังพลาสติก", priority: 1 },

  // === อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง (40 missed) ===
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", field: "note", pattern: "บานพับ", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", field: "note", pattern: "อุปกรณ์เน็ตเวิร์ก", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", field: "note", pattern: "Sensor", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง", field: "note", pattern: "งูเหล็ก", priority: 1 },

  // === ค่าจ้างพนักงานชั่วคราว (26 missed) ===
  { category: "ค่าจ้างพนักงานชั่วคราว", field: "note", pattern: "เคลียร์เงินทดรอง", priority: 1 },
  { category: "ค่าจ้างพนักงานชั่วคราว", field: "note", pattern: "เคลียร์ทดรองจ่าย", priority: 1 },
  { category: "ค่าจ้างพนักงานชั่วคราว", field: "note", pattern: "PT ช่าง", priority: 1 },
  { category: "ค่าจ้างพนักงานชั่วคราว", field: "note", pattern: "pt ช่าง", priority: 1 },

  // === ค่าใช้จ่ายส่วนตัว-ภูมิ (23 missed) ===
  { category: "ค่าใช้จ่ายส่วนตัว-ภูมิ", field: "note", pattern: "key board", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ภูมิ", field: "note", pattern: "TAX BOOK", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ภูมิ", field: "note", pattern: "ป้าภูมิ", priority: 1 },
  { category: "ค่าใช้จ่ายส่วนตัว-ภูมิ", field: "description", pattern: "นางสุจิรา แก้วอ่อน", priority: 1 },

  // === ค่าตวจสอบสภาพรถและภาษียานภาหนะ (21 missed) ===
  { category: "ค่าตวจสอบสภาพรถและภาษียานภาหนะ", field: "note", pattern: "ประกันรถ", priority: 1 },
  { category: "ค่าตวจสอบสภาพรถและภาษียานภาหนะ", field: "note", pattern: "พรบ", priority: 1 },
  { category: "ค่าตวจสอบสภาพรถและภาษียานภาหนะ", field: "note", pattern: "ประกันภัย", priority: 1 },
  { category: "ค่าตวจสอบสภาพรถและภาษียานภาหนะ", field: "note", pattern: "ตรวจสภาพ", priority: 1 },
  { category: "ค่าตวจสอบสภาพรถและภาษียานภาหนะ", field: "description", pattern: "ศรีกรุงโบรคเกอร์", priority: 1 },

  // === ค่าจ้างบริการเว็บไซต์ (18 missed) ===
  { category: "ค่าจ้างบริการเว็บไซต์", field: "note", pattern: "ดูแลเว็บไซท์", priority: 1 },
  { category: "ค่าจ้างบริการเว็บไซต์", field: "note", pattern: "ต่อโปร Peak", priority: 1 },
  { category: "ค่าจ้างบริการเว็บไซต์", field: "note", pattern: "ระบบฮิวแมน", priority: 1 },
  { category: "ค่าจ้างบริการเว็บไซต์", field: "note", pattern: "human soft", priority: 1 },
  { category: "ค่าจ้างบริการเว็บไซต์", field: "description", pattern: "HUMAN SOFT", priority: 1 },

  // === ค่าธรรมเนียมธนาคาร (17 missed) ===
  { category: "ค่าธรรมเนียมธนาคาร", field: "description", pattern: "จากระบบเงินฝาก", priority: 1 },
  { category: "ค่าธรรมเนียมธนาคาร", field: "description", pattern: "CARD OPERATION", priority: 1 },

  // === ค่าขนส่งสินค้า (15 missed) ===
  { category: "ค่าขนส่งสินค้า", field: "note", pattern: "ค่าขนส่ง", priority: 1 },

  // === อุปกรณ์ของใช้งานจัดเลี้ยง-ครัว (15 missed) ===
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ครัว", field: "note", pattern: "หม้อหุงข้าว", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ครัว", field: "note", pattern: "อุปกรณ์ ครัว", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ครัว", field: "note", pattern: "อุปกรณ์เครื่องครัว", priority: 1 },
  { category: "อุปกรณ์ของใช้งานจัดเลี้ยง-ครัว", field: "note", pattern: "ลังหูเหล็ก", priority: 1 },
]

export async function importFinalRules(): Promise<{
  success: boolean
  imported: number
  skipped: number
  errors: string[]
}> {
  const errors: string[] = []
  let imported = 0
  let skipped = 0

  for (const rule of FINAL_RULES) {
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
