import * as XLSX from 'xlsx'
import * as fs from 'fs'

const filePath = 'C:\\Users\\OatJirakitt\\Downloads\\statement-2023.xlsx'

const buffer = fs.readFileSync(filePath)
const workbook = XLSX.read(buffer, { type: 'buffer' })
const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' }) as any[]

console.log(`Total Rows: ${jsonData.length}`)

// Get all unique chart values with count
const chartCount = new Map<string, number>()
jsonData.forEach(row => {
  const chart = row['chart'] || 'ไม่ระบุ'
  chartCount.set(chart, (chartCount.get(chart) || 0) + 1)
})

// Sort by count descending
const sortedCharts = Array.from(chartCount.entries()).sort((a, b) => b[1] - a[1])

console.log('\n=== หมวดหมู่ทั้งหมด (เรียงตามจำนวน) ===')
sortedCharts.forEach(([chart, count]) => {
  console.log(`${count.toString().padStart(5)} | ${chart}`)
})

console.log(`\n=== จำนวนหมวดหมู่ทั้งหมด: ${chartCount.size} ===`)

// Analyze patterns in Description for each category
console.log('\n\n=== วิเคราะห์ Pattern ของแต่ละหมวดหมู่ ===')
const topCategories = sortedCharts.slice(0, 15)

topCategories.forEach(([chart, count]) => {
  console.log(`\n### ${chart} (${count} รายการ) ###`)

  const rows = jsonData.filter(r => (r['chart'] || 'ไม่ระบุ') === chart)

  // Get sample descriptions
  const descriptions = rows.slice(0, 5).map(r => r['Description'])
  const notes = rows.slice(0, 5).map(r => r['Note']).filter(Boolean)

  console.log('ตัวอย่าง Description:')
  descriptions.forEach(d => console.log(`  - ${d}`))

  if (notes.length > 0) {
    console.log('ตัวอย่าง Note:')
    notes.forEach(n => console.log(`  - ${n}`))
  }

  // Find common patterns
  const descWords = new Map<string, number>()
  rows.forEach(r => {
    const desc = r['Description'] || ''
    // Extract key patterns
    if (desc.includes('โอนไป')) descWords.set('โอนไป', (descWords.get('โอนไป') || 0) + 1)
    if (desc.includes('Transfer to')) descWords.set('Transfer to', (descWords.get('Transfer to') || 0) + 1)
    if (desc.includes('PromptPay')) descWords.set('PromptPay', (descWords.get('PromptPay') || 0) + 1)
    if (desc.includes('จ่ายบิล')) descWords.set('จ่ายบิล', (descWords.get('จ่ายบิล') || 0) + 1)
    if (desc.includes('รับโอน')) descWords.set('รับโอน', (descWords.get('รับโอน') || 0) + 1)
    if (desc.includes('SCB')) descWords.set('SCB', (descWords.get('SCB') || 0) + 1)
    if (desc.includes('KBANK')) descWords.set('KBANK', (descWords.get('KBANK') || 0) + 1)
    if (desc.includes('KTB')) descWords.set('KTB', (descWords.get('KTB') || 0) + 1)
    if (desc.includes('BBL')) descWords.set('BBL', (descWords.get('BBL') || 0) + 1)
  })

  const patterns = Array.from(descWords.entries()).filter(([_, c]) => c > 1).sort((a, b) => b[1] - a[1])
  if (patterns.length > 0) {
    console.log('Patterns พบบ่อย:')
    patterns.forEach(([word, c]) => console.log(`  ${word}: ${c}`))
  }
})

// Analyze Note patterns
console.log('\n\n=== วิเคราะห์ Keywords ใน Note ===')
const noteKeywords = new Map<string, Set<string>>()

jsonData.forEach(row => {
  const note = row['Note'] || ''
  const chart = row['chart'] || 'ไม่ระบุ'

  // Extract keywords from note
  const keywords = [
    'น้ำมัน', 'เต๊นท์', 'โต๊ะ', 'เก้าอี้', 'พาร์ทไทม์', 'PO', 'ซื้อสินค้า',
    'รับพระ', 'การตลาด', 'ค่าแรง', 'เงินเดือน', 'ค่าจ้าง', 'ค่าเช่า',
    'อุปกรณ์', 'ไฟ', 'เบิก', 'ซื้อของ', 'แมคโคร', 'บิ๊กซี', 'โลตัส'
  ]

  keywords.forEach(kw => {
    if (note.includes(kw)) {
      if (!noteKeywords.has(kw)) noteKeywords.set(kw, new Set())
      noteKeywords.get(kw)!.add(chart)
    }
  })
})

console.log('Keyword -> หมวดหมู่:')
noteKeywords.forEach((charts, keyword) => {
  console.log(`  "${keyword}" -> ${Array.from(charts).join(', ')}`)
})
