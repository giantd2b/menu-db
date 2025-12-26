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
  const chart = row['chart'] || ''
  if (chart.trim()) {
    chartCount.set(chart.trim(), (chartCount.get(chart.trim()) || 0) + 1)
  }
})

// Sort by count descending
const sortedCharts = Array.from(chartCount.entries()).sort((a, b) => b[1] - a[1])

console.log(`\n=== หมวดหมู่ทั้งหมด ${chartCount.size} หมวด ===\n`)

// Generate colors for categories
const colors = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#78716c', '#71717a',
]

// Output as JSON for import
const categories = sortedCharts.map(([name, count], index) => ({
  name,
  description: `${count} รายการ`,
  color: colors[index % colors.length],
  count,
}))

console.log('Categories to create:')
console.log(JSON.stringify(categories, null, 2))

// Write to file for use in seed
fs.writeFileSync(
  'C:\\Users\\OatJirakitt\\Documents\\GitHub\\menu-db\\scripts\\categories-from-excel.json',
  JSON.stringify(categories, null, 2)
)

console.log('\n=== Saved to scripts/categories-from-excel.json ===')
