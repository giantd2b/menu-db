import * as XLSX from 'xlsx'
import * as fs from 'fs'

const filePath = 'C:\\Users\\OatJirakitt\\Downloads\\statement-2023.xlsx'

const buffer = fs.readFileSync(filePath)
const workbook = XLSX.read(buffer, { type: 'buffer' })
const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' }) as any[]

// Group transactions by category (chart column)
const categoryExamples = new Map<string, { note: string, description: string, amount: number }[]>()

jsonData.forEach(row => {
  const chart = row['chart']?.trim() || ''
  const note = row['Note']?.trim() || ''
  const description = row['Description']?.trim() || ''
  const withdrawal = parseFloat(row['Withdrawal']?.replace(/,/g, '') || '0')

  // Only process withdrawals with category
  if (!withdrawal || withdrawal <= 0 || !chart) return

  if (!categoryExamples.has(chart)) {
    categoryExamples.set(chart, [])
  }

  const examples = categoryExamples.get(chart)!
  // Keep max 5 diverse examples per category
  if (examples.length < 5 && note) {
    // Check if similar note already exists
    const hasSimilar = examples.some(e =>
      e.note.toLowerCase().includes(note.toLowerCase().substring(0, 10)) ||
      note.toLowerCase().includes(e.note.toLowerCase().substring(0, 10))
    )
    if (!hasSimilar) {
      examples.push({
        note,
        description: description.substring(0, 50),
        amount: withdrawal
      })
    }
  }
})

// Sort by number of examples
const sortedCategories = Array.from(categoryExamples.entries())
  .filter(([_, examples]) => examples.length >= 2)
  .sort((a, b) => b[1].length - a[1].length)

console.log(`Found ${sortedCategories.length} categories with examples\n`)

// Generate training data JSON
const trainingData: Record<string, { note: string, description: string }[]> = {}

sortedCategories.forEach(([category, examples]) => {
  trainingData[category] = examples.map(e => ({
    note: e.note,
    description: e.description
  }))
})

// Save to file
const outputPath = 'src/lib/data/training-examples.json'
fs.writeFileSync(outputPath, JSON.stringify(trainingData, null, 2), 'utf-8')
console.log(`Saved training data to ${outputPath}`)

// Print summary
console.log('\n=== Training Data Summary ===\n')
sortedCategories.slice(0, 20).forEach(([category, examples]) => {
  console.log(`${category}: ${examples.length} examples`)
  examples.slice(0, 2).forEach(e => {
    console.log(`  - "${e.note}"`)
  })
})
