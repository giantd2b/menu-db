import { CleanedTransaction } from './clean-data'
import { prisma } from '@/lib/prisma'

/**
 * กฎสำหรับจัดหมวดหมู่อัตโนมัติ (hardcoded)
 */
interface CategoryRule {
  category: string
  notePatterns?: (string | RegExp)[]      // ตรวจสอบใน Note
  descPatterns?: (string | RegExp)[]      // ตรวจสอบใน Description
  priority: number // ยิ่งต่ำยิ่งสำคัญ
}

/**
 * กฎจาก Database
 */
interface DbRule {
  categoryName: string
  field: string
  pattern: string
  isRegex: boolean
  priority: number
}

/**
 * Default categories ที่จะถูกสร้างในระบบ (77 หมวดหมู่)
 */
export const DEFAULT_CATEGORIES = [
  // === ต้นทุน/ค่าใช้จ่ายหลัก ===
  { name: 'ต้นทุนการให้บริการ', description: 'ต้นทุนการให้บริการจัดเลี้ยง', color: '#ef4444' },
  { name: 'ต้นทุนการก่อสร้าง', description: 'ต้นทุนการก่อสร้างและปรับปรุง', color: '#dc2626' },

  // === ค่าจ้าง/เงินเดือน ===
  { name: 'ค่าจ้างพนักงานชั่วคราว', description: 'ค่าจ้างพาร์ทไทม์', color: '#f97316' },
  { name: 'เงินเดือน ค่าจ้าง', description: 'เงินเดือนพนักงานประจำ', color: '#fb923c' },
  { name: 'เงินเดือนค้างจ่าย', description: 'เงินเดือนค้างจ่าย', color: '#fdba74' },
  { name: 'ค่าตอบแทนกรรมการ', description: 'ค่าตอบแทนกรรมการ', color: '#fed7aa' },
  { name: 'โบนัส', description: 'โบนัสพนักงาน', color: '#ffedd5' },

  // === ค่าเช่า ===
  { name: 'ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้', description: 'ค่าเช่าเต๊นท์ โต๊ะ เก้าอี้', color: '#eab308' },
  { name: 'ค่าเช่าอุปกรณ์', description: 'ค่าเช่าอุปกรณ์อื่นๆ', color: '#facc15' },
  { name: 'ค่าเช่าสำนักงาน', description: 'ค่าเช่าสำนักงาน', color: '#fde047' },
  { name: 'ค่าเช่ายานพาหนะ', description: 'ค่าเช่ารถ', color: '#fef08a' },

  // === ค่าขนส่ง/เดินทาง ===
  { name: 'ค่ารถรับส่งพระ', description: 'ค่ารถรับส่งพระ', color: '#22c55e' },
  { name: 'ค่าน้ำมัน', description: 'ค่าน้ำมันรถ', color: '#4ade80' },
  { name: 'ค่าทางด่วน', description: 'ค่าทางด่วน', color: '#86efac' },
  { name: 'ค่าขนส่งสินค้า', description: 'ค่าขนส่งสินค้า', color: '#bbf7d0' },
  { name: 'ค่าเบี้ยเลี้ยงเดินทาง', description: 'ค่าเบี้ยเลี้ยงเดินทาง', color: '#dcfce7' },

  // === อุปกรณ์จัดเลี้ยง ===
  { name: 'อุปกรณ์ของใช้งานจัดเลี้ยง', description: 'อุปกรณ์งานจัดเลี้ยงทั่วไป', color: '#3b82f6' },
  { name: 'อุปกรณ์ของใช้งานจัดเลี้ยง-FB', description: 'อุปกรณ์แผนก F&B', color: '#60a5fa' },
  { name: 'อุปกรณ์ของใช้งานจัดเลี้ยง-ช่าง', description: 'อุปกรณ์แผนกช่าง', color: '#93c5fd' },
  { name: 'อุปกรณ์ของใช้งานจัดเลี้ยง-ครัว', description: 'อุปกรณ์ครัว', color: '#bfdbfe' },
  { name: 'อุปกรณ์ของใช้งานจัดเลี้ยง-Back-office', description: 'อุปกรณ์ Back-office', color: '#dbeafe' },
  { name: 'อุปกรณ์ของใช้งานจัดเลี้ยง-งานแต่ง', description: 'อุปกรณ์งานแต่งงาน', color: '#eff6ff' },

  // === ค่าซ่อมบำรุง ===
  { name: 'ค่าซ่อมแซม', description: 'ค่าซ่อมแซมทั่วไป', color: '#8b5cf6' },
  { name: 'ค่าตวจสอบสภาพรถและภาษียานภาหนะ', description: 'ค่าตรวจสภาพรถและภาษี', color: '#a78bfa' },

  // === สาธารณูปโภค ===
  { name: 'ค่าไฟฟ้า', description: 'ค่าไฟฟ้า', color: '#f59e0b' },
  { name: 'ค่าประปา', description: 'ค่าน้ำประปา', color: '#fbbf24' },
  { name: 'ค่าโทรศัพท์สำนักงาน', description: 'ค่าโทรศัพท์', color: '#fcd34d' },

  // === การตลาด/โฆษณา ===
  { name: 'ค่าจ้างที่ปรึกษาการตลาด', description: 'ค่าที่ปรึกษาการตลาด', color: '#ec4899' },
  { name: 'ค่าโฆษณา Facebook Ads', description: 'ค่าโฆษณา Facebook', color: '#f472b6' },
  { name: 'ค่าโฆษณา Google Adwords', description: 'ค่าโฆษณา Google', color: '#f9a8d4' },
  { name: 'ค่าโฆษณาออนไลน์อื่น', description: 'ค่าโฆษณาออนไลน์อื่นๆ', color: '#fbcfe8' },
  { name: 'ค่าโฆษณาอื่นๆ', description: 'ค่าโฆษณาอื่นๆ', color: '#fce7f3' },
  { name: 'ค่าส่งเสริมการขาย', description: 'ค่าส่งเสริมการขาย', color: '#fdf2f8' },
  { name: 'ค่าจ้างผลิตสื่อโฆษณา', description: 'ค่าผลิตสื่อ', color: '#fae8ff' },

  // === IT/เว็บไซต์ ===
  { name: 'ค่าจ้างบริการเว็บไซต์', description: 'ค่าบริการเว็บไซต์', color: '#06b6d4' },
  { name: 'ค่าบริการโฮสติ้ง และเว็บไซต์', description: 'ค่าโฮสติ้ง', color: '#22d3ee' },
  { name: 'ค่าบริการคลาวด์เซอร์วิซ', description: 'ค่าบริการ Cloud', color: '#67e8f9' },

  // === เจ้าหนี้/หนี้สิน ===
  { name: 'เจ้าหนี้เช่าซื้อ', description: 'ค่างวดรถเช่าซื้อ', color: '#64748b' },
  { name: 'เจ้าหนี้สรรพากร', description: 'ภาษีค้างจ่าย', color: '#94a3b8' },
  { name: 'เจ้าหนี้-ค่างวดรถ ยจ6170', description: 'ค่างวดรถ ยจ6170', color: '#cbd5e1' },
  { name: 'เจ้าหนี้-ค่างวดรถ 2ฒฬ1816', description: 'ค่างวดรถ 2ฒฬ1816', color: '#e2e8f0' },
  { name: 'เจ้าหนี้-ค่างวดรถ ยจ9612', description: 'ค่างวดรถ ยจ9612', color: '#f1f5f9' },
  { name: 'ชำระหนี้-ศิริ', description: 'ชำระหนี้ศิริ', color: '#475569' },
  { name: 'ชำระหนี้-ภูมิ', description: 'ชำระหนี้ภูมิ', color: '#334155' },

  // === ภาษี ===
  { name: 'ภาษีขาย ภ.พ.30', description: 'ภาษีขาย', color: '#991b1b' },
  { name: 'ภาษีถูกหัก ณ ที่จ่าย', description: 'ภาษีหัก ณ ที่จ่าย', color: '#b91c1c' },
  { name: 'ภาษีเงินได้', description: 'ภาษีเงินได้', color: '#dc2626' },
  { name: 'ภาษีเงินได้ค้างจ่าย', description: 'ภาษีเงินได้ค้างจ่าย', color: '#ef4444' },
  { name: 'ภาษีโรงเรือนและสิ่งปลูกสร้าง', description: 'ภาษีโรงเรือน', color: '#f87171' },
  { name: 'ภาษีบำรุงท้องที่', description: 'ภาษีบำรุงท้องที่', color: '#fca5a5' },

  // === ประกันสังคม ===
  { name: 'ประกันสังคมค้างจ่าย', description: 'ประกันสังคมค้างจ่าย', color: '#0891b2' },
  { name: 'เงินสมทบประกันสังคม และกองทุนทดแทน', description: 'เงินสมทบประกันสังคม', color: '#06b6d4' },

  // === สวัสดิการ ===
  { name: 'ค่าสวัสดิการอื่นๆ', description: 'สวัสดิการพนักงาน', color: '#14b8a6' },
  { name: 'ค่าสวัสดิการอาหาร เครื่องดื่ม', description: 'สวัสดิการอาหาร', color: '#2dd4bf' },
  { name: 'ค่าอบรม สัมมนา', description: 'ค่าอบรม', color: '#5eead4' },

  // === ค่าธรรมเนียม ===
  { name: 'ค่าธรรมเนียมธนาคาร', description: 'ค่าธรรมเนียมธนาคาร', color: '#f43f5e' },
  { name: 'ค่าธรรมเนียมอื่นๆ', description: 'ค่าธรรมเนียมอื่นๆ', color: '#fb7185' },

  // === ค่าบริการ ===
  { name: 'ค่าบริการอื่นๆ', description: 'ค่าบริการอื่นๆ', color: '#6366f1' },
  { name: 'ค่าบริการสอบบัญชี', description: 'ค่าสอบบัญชี', color: '#818cf8' },
  { name: 'ค่าบริการบัญชี', description: 'ค่าบริการบัญชี', color: '#a5b4fc' },
  { name: 'ค่ารักษาความปลอดภัย', description: 'ค่ารปภ.', color: '#c7d2fe' },
  { name: 'ค่ารักษาความสะอาด', description: 'ค่าทำความสะอาด', color: '#e0e7ff' },

  // === สินทรัพย์ ===
  { name: 'สินทรัพย์ไม่หมุนเวียนอื่น', description: 'สินทรัพย์ถาวร', color: '#84cc16' },
  { name: 'ค่าอุปกรณ์และเครื่องใช้สำนักงาน', description: 'อุปกรณ์สำนักงาน', color: '#a3e635' },

  // === วัสดุสิ้นเปลือง ===
  { name: 'วัสดุสิ้นเปลืองงานแต่ง', description: 'วัสดุงานแต่ง', color: '#d946ef' },
  { name: 'วัสดุสิ้นเปลืองงานแต่ง-ค่าใช้จ่ายงานแต่ง', description: 'ค่าใช้จ่ายงานแต่ง', color: '#e879f9' },

  // === เงินสด/เงินทุน ===
  { name: 'เงินสด', description: 'เงินสดย่อย', color: '#10b981' },
  { name: 'เงินจ่ายล่วงหน้า - เงินมัดจำ', description: 'เงินมัดจำจ่าย', color: '#34d399' },
  { name: 'เงินรับล่วงหน้า - เงินมัดจำ', description: 'เงินมัดจำรับ', color: '#6ee7b7' },
  { name: 'เงินปันผล', description: 'เงินปันผล', color: '#a7f3d0' },
  { name: 'เงินลงทุนในบริษัทย่อย', description: 'เงินลงทุนบริษัทย่อย', color: '#d1fae5' },
  { name: 'เงินลงทุนเผื่อขาย', description: 'เงินลงทุนเผื่อขาย', color: '#ecfdf5' },
  { name: 'สำรองจ่ายแทนกิจการที่ยังไม่ได้คืนเงิน - ภูมิ', description: 'สำรองจ่ายแทน-ภูมิ', color: '#059669' },

  // === ส่วนตัว ===
  { name: 'ค่าใช้จ่ายส่วนตัว-ภูมิ', description: 'ค่าใช้จ่ายส่วนตัวภูมิ', color: '#7c3aed' },
  { name: 'ค่าใช้จ่ายส่วนตัว-ศิริ', description: 'ค่าใช้จ่ายส่วนตัวศิริ', color: '#8b5cf6' },

  // === เงินโอนภายใน ===
  { name: 'เงินโอนระหว่างบัญชีบริษัท', description: 'โอนเงินระหว่างบัญชีบริษัทในเครือ', color: '#0ea5e9' },

  // === อื่นๆ ===
  { name: 'ค่าใช้จ่ายอื่น', description: 'ค่าใช้จ่ายอื่นๆ ทั่วไป', color: '#94a3b8' },
  { name: 'ไม่ระบุ', description: 'ยังไม่ได้จัดหมวดหมู่', color: '#cbd5e1' },
] as const

/**
 * กฎสำหรับจัดหมวดหมู่ - เรียงตาม priority (ต่ำ = สำคัญกว่า)
 * ใช้ Note เป็นหลักในการจัดหมวดหมู่
 */
const CATEGORY_RULES: CategoryRule[] = [
  // === Priority 0: เงินโอนระหว่างบัญชีบริษัท (สำคัญที่สุด) ===
  {
    category: 'เงินโอนระหว่างบัญชีบริษัท',
    notePatterns: ['เติมบุญ', 'ไอริส', /โอน.*เติมบุญ/i, /โอน.*ไอริส/i],
    descPatterns: ['เติมบุญ', 'ไอริส', /TERMBOON/i, /IRIS/i],
    priority: 0,
  },

  // === Priority 1: คำเฉพาะเจาะจงมากที่สุด ===
  {
    category: 'ค่ารถรับส่งพระ',
    notePatterns: ['รับพระ', /รับ.*พระ/i],
    priority: 1,
  },
  {
    category: 'ค่าจ้างพนักงานชั่วคราว',
    notePatterns: ['พาร์ทไทม์', 'พาร์ท', 'parttime', /เบิก.*ทดรอง.*พาร์ท/i],
    priority: 1,
  },
  {
    category: 'ต้นทุนการให้บริการ',
    notePatterns: [/^PO\s/, 'PO ซื้อสินค้า', /ร้าน.*ซีฟู้ด/i, /ร้าน.*กุ้ง/i],
    priority: 1,
  },
  {
    category: 'ค่าเช่าเต้นท์-โต๊ะ-เก้าอี้',
    notePatterns: ['เต๊นท์', 'เต้นท์', /เช่า.*โต๊ะ.*เก้าอี้/i, /โต๊ะ.*เก้าอี้/i],
    priority: 1,
  },
  {
    category: 'ค่าจ้างที่ปรึกษาการตลาด',
    notePatterns: ['ค่าการตลาด', /ที่ปรึกษา.*การตลาด/i],
    priority: 1,
  },

  // === Priority 2: Description patterns ===
  {
    category: 'เจ้าหนี้เช่าซื้อ',
    descPatterns: ['TOYOTA LEASING', 'TRI PETCH ISUZU', /LEASING/i],
    priority: 2,
  },
  {
    category: 'ต้นทุนการก่อสร้าง',
    descPatterns: ['CPAC TaLuang', 'CPAC'],
    notePatterns: ['ค่าเทปูน', 'ค่าปูน'],
    priority: 2,
  },
  {
    category: 'เงินเดือน ค่าจ้าง',
    descPatterns: ['PAY PEAK-Payroll', 'Payroll'],
    notePatterns: ['เงินเดือน'],
    priority: 2,
  },

  // === Priority 3: Note keywords ===
  {
    category: 'ค่าน้ำมัน',
    notePatterns: ['น้ำมัน', /ออกงาน/i, /เซท.*งาน/i, /เซ็ท.*งาน/i],
    priority: 3,
  },
  {
    category: 'ค่าซ่อมแซม',
    notePatterns: ['ค่าซ่อม', 'ซ่อมบำรุง', 'ซ่อมรถ'],
    priority: 3,
  },
  {
    category: 'อุปกรณ์ของใช้งานจัดเลี้ยง',
    notePatterns: ['ไฟสนาม', 'ภาชนะ', 'ปลอกเก้าอี้', 'พรม'],
    priority: 3,
  },
  {
    category: 'ค่าโฆษณา Facebook Ads',
    descPatterns: ['FACEBOOK', 'Facebook'],
    priority: 3,
  },
  {
    category: 'ค่าโฆษณา Google Adwords',
    descPatterns: ['GOOGLE', 'Google'],
    priority: 3,
  },
  {
    category: 'ค่าไฟฟ้า',
    notePatterns: ['ค่าไฟ'],
    descPatterns: [/การไฟฟ้า/i, 'PEA', 'MEA'],
    priority: 3,
  },
  {
    category: 'ค่าธรรมเนียมธนาคาร',
    descPatterns: ['ค่าธรรมเนียม', 'Bank Fee', 'Service Charge'],
    priority: 3,
  },

  // === Priority 4: Fallback based on transaction type ===
  {
    category: 'ค่าใช้จ่ายอื่น',
    notePatterns: ['Petty Cash', 'เบิก'],
    priority: 4,
  },
]

/**
 * ตรวจสอบว่า text ตรงกับ pattern หรือไม่
 */
function matchesPattern(text: string, pattern: string | RegExp): boolean {
  if (!text) return false
  if (typeof pattern === 'string') {
    return text.toLowerCase().includes(pattern.toLowerCase())
  }
  return pattern.test(text)
}

/**
 * ตรวจสอบว่า text ตรงกับ pattern ใดๆ ใน array หรือไม่
 */
function matchesAnyPattern(text: string, patterns: (string | RegExp)[]): boolean {
  return patterns.some(pattern => matchesPattern(text, pattern))
}

/**
 * จัดหมวดหมู่ transaction อัตโนมัติ
 * @param transaction - ข้อมูล transaction ที่ cleaned แล้ว
 * @returns ชื่อ category ที่เหมาะสม
 */
export function categorizeTransaction(transaction: CleanedTransaction): string {
  const note = transaction.note || ''
  const description = transaction.description || ''
  const rawDescription = transaction.rawDescription || ''
  const allText = `${description} ${rawDescription} ${note}`

  // เรียง rules ตาม priority
  const sortedRules = [...CATEGORY_RULES].sort((a, b) => a.priority - b.priority)

  for (const rule of sortedRules) {
    // ตรวจสอบ Note patterns ก่อน (สำคัญกว่า)
    if (rule.notePatterns && matchesAnyPattern(note, rule.notePatterns)) {
      return rule.category
    }

    // ตรวจสอบ Description patterns
    if (rule.descPatterns && matchesAnyPattern(allText, rule.descPatterns)) {
      return rule.category
    }
  }

  return 'ไม่ระบุ'
}

/**
 * จัดหมวดหมู่ transactions หลายรายการพร้อมกัน
 * @param transactions - array ของ transactions
 * @returns Map ของ transaction index → category name
 */
export function categorizeTransactions(
  transactions: CleanedTransaction[]
): Map<number, string> {
  const result = new Map<number, string>()

  transactions.forEach((transaction, index) => {
    result.set(index, categorizeTransaction(transaction))
  })

  return result
}

/**
 * ดึง rules จาก database
 */
async function getDbRules(): Promise<DbRule[]> {
  const rules = await prisma.categoryRule.findMany({
    where: { isActive: true },
    include: {
      category: {
        select: { name: true },
      },
    },
    orderBy: { priority: 'asc' },
  })

  return rules.map((rule) => ({
    categoryName: rule.category.name,
    field: rule.field,
    pattern: rule.pattern,
    isRegex: rule.isRegex,
    priority: rule.priority,
  }))
}

/**
 * ตรวจสอบ text กับ pattern จาก DB rule
 */
function matchesDbPattern(text: string, pattern: string, isRegex: boolean): boolean {
  if (!text) return false
  if (isRegex) {
    try {
      const regex = new RegExp(pattern, 'i')
      return regex.test(text)
    } catch {
      return false
    }
  }
  return text.toLowerCase().includes(pattern.toLowerCase())
}

/**
 * จัดหมวดหมู่ transaction โดยใช้ rules จาก database
 * ใช้ในกรณี server-side (upload transactions)
 * หมายเหตุ: Rules ใช้เฉพาะรายจ่าย (withdrawal) เท่านั้น
 * @param useAIFallback - ถ้า true จะใช้ AI เมื่อ rules ไม่ match (ช้ากว่าแต่แม่นกว่า)
 */
export async function categorizeTransactionWithDbRules(
  transaction: CleanedTransaction,
  useAIFallback: boolean = false
): Promise<string> {
  // Rules ใช้เฉพาะรายจ่าย (withdrawal) เท่านั้น
  // ถ้าเป็นรายรับ (deposit) ให้ return "ไม่ระบุ"
  if (!transaction.withdrawal || transaction.withdrawal <= 0) {
    return 'ไม่ระบุ'
  }

  const note = transaction.note || ''
  const description = transaction.description || ''
  const rawDescription = transaction.rawDescription || ''
  const allDesc = `${description} ${rawDescription}`

  // ดึง rules จาก database
  const dbRules = await getDbRules()

  // ถ้ามี rules ใน DB ให้ใช้ rules จาก DB
  if (dbRules.length > 0) {
    for (const rule of dbRules) {
      const textToCheck = rule.field === 'note' ? note : allDesc
      if (matchesDbPattern(textToCheck, rule.pattern, rule.isRegex)) {
        return rule.categoryName
      }
    }
  }

  // ถ้าไม่มี rules ใน DB หรือไม่ match ให้ใช้ hardcoded rules
  const hardcodedResult = categorizeTransaction(transaction)

  // ถ้า hardcoded rules ก็ไม่ match และเปิดใช้ AI fallback
  if (hardcodedResult === 'ไม่ระบุ' && useAIFallback) {
    try {
      const { categorizeWithAI } = await import('@/lib/services/ai-categorize')
      const aiResult = await categorizeWithAI({
        note,
        description: allDesc,
        withdrawal: transaction.withdrawal ?? undefined,
        deposit: transaction.deposit ?? undefined,
      })

      if (aiResult && aiResult.category !== 'ไม่ระบุ' && aiResult.confidence !== 'low') {
        return aiResult.category
      }
    } catch (error) {
      console.error('AI categorization failed:', error)
    }
  }

  return hardcodedResult
}

/**
 * จัดหมวดหมู่ transaction โดยใช้ AI เป็นหลัก (ไม่ใช้ rules)
 * ใช้สำหรับ withdrawal transactions เท่านั้น
 * AI ได้เรียนรู้จากข้อมูลที่ manual แล้ว (few-shot learning)
 */
export async function categorizeTransactionWithAI(
  transaction: CleanedTransaction
): Promise<string> {
  // AI ใช้เฉพาะรายจ่าย (withdrawal) เท่านั้น
  if (!transaction.withdrawal || transaction.withdrawal <= 0) {
    return 'ไม่ระบุ'
  }

  const note = transaction.note || ''
  const description = transaction.description || ''
  const rawDescription = transaction.rawDescription || ''
  const allDesc = `${description} ${rawDescription}`

  try {
    const { categorizeWithAI } = await import('@/lib/services/ai-categorize')
    const aiResult = await categorizeWithAI({
      note,
      description: allDesc,
      withdrawal: transaction.withdrawal ?? undefined,
      deposit: transaction.deposit ?? undefined,
    })

    if (aiResult && aiResult.category && aiResult.confidence !== 'low') {
      return aiResult.category
    }
  } catch (error) {
    console.error('AI categorization failed:', error)
  }

  // Fallback to 'ไม่ระบุ' if AI fails
  return 'ไม่ระบุ'
}
