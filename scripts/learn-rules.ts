import * as XLSX from 'xlsx'
import * as fs from 'fs'

const filePath = 'C:\\Users\\OatJirakitt\\Downloads\\statement-2023.xlsx'

const buffer = fs.readFileSync(filePath)
const workbook = XLSX.read(buffer, { type: 'buffer' })
const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' }) as any[]

console.log(`Total Rows: ${jsonData.length}\n`)

// Group by category
const categoryData = new Map<string, { notes: string[], descriptions: string[] }>()

jsonData.forEach(row => {
  const chart = row['chart']?.trim() || ''
  const note = row['Note']?.trim() || ''
  const description = row['Description']?.trim() || ''

  if (!chart) return

  if (!categoryData.has(chart)) {
    categoryData.set(chart, { notes: [], descriptions: [] })
  }

  const data = categoryData.get(chart)!
  if (note) data.notes.push(note)
  if (description) data.descriptions.push(description)
})

// Analyze patterns for each category
interface LearnedRule {
  category: string
  field: 'note' | 'description'
  pattern: string
  confidence: number // percentage of matches
  sampleCount: number
}

const learnedRules: LearnedRule[] = []

// Function to find common words/phrases
function findCommonPatterns(texts: string[], minOccurrence: number = 3): Map<string, number> {
  const patterns = new Map<string, number>()

  texts.forEach(text => {
    // Split into words and phrases
    const words = text.split(/[\s,\-\/]+/).filter(w => w.length >= 2)

    // Count single words
    words.forEach(word => {
      if (word.length >= 3) {
        patterns.set(word, (patterns.get(word) || 0) + 1)
      }
    })

    // Count 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`
      if (phrase.length >= 5) {
        patterns.set(phrase, (patterns.get(phrase) || 0) + 1)
      }
    }
  })

  // Filter by minimum occurrence
  const filtered = new Map<string, number>()
  patterns.forEach((count, pattern) => {
    if (count >= minOccurrence) {
      filtered.set(pattern, count)
    }
  })

  return filtered
}

// Common words to ignore
const stopWords = new Set([
  'การ', 'ของ', 'และ', 'ที่', 'ใน', 'จาก', 'ให้', 'ได้', 'เป็น', 'มี', 'ไม่',
  'เงิน', 'บาท', 'โอน', 'โอนไป', 'รับโอน', 'Transfer', 'from', 'to', 'the',
  'SCB', 'KBANK', 'KTB', 'BBL', 'BAY', 'TMB', 'PromptPay', 'X/X', 'ENET',
  'BCMS', '000', '001', '002', '003', 'xxx', 'บัญชี', 'เลขที่',
])

// Analyze each category
categoryData.forEach((data, category) => {
  const totalSamples = data.notes.length || data.descriptions.length

  // Analyze notes
  if (data.notes.length >= 3) {
    const notePatterns = findCommonPatterns(data.notes, Math.max(3, Math.floor(data.notes.length * 0.1)))

    notePatterns.forEach((count, pattern) => {
      if (!stopWords.has(pattern) && pattern.length >= 3) {
        const confidence = (count / data.notes.length) * 100
        if (confidence >= 20) { // At least 20% of samples match
          learnedRules.push({
            category,
            field: 'note',
            pattern,
            confidence: Math.round(confidence),
            sampleCount: count,
          })
        }
      }
    })
  }

  // Analyze descriptions (only if not enough note patterns)
  const noteRulesForCat = learnedRules.filter(r => r.category === category && r.field === 'note')
  if (noteRulesForCat.length < 2 && data.descriptions.length >= 3) {
    const descPatterns = findCommonPatterns(data.descriptions, Math.max(3, Math.floor(data.descriptions.length * 0.1)))

    descPatterns.forEach((count, pattern) => {
      if (!stopWords.has(pattern) && pattern.length >= 4) {
        const confidence = (count / data.descriptions.length) * 100
        if (confidence >= 30) { // Higher threshold for descriptions
          learnedRules.push({
            category,
            field: 'description',
            pattern,
            confidence: Math.round(confidence),
            sampleCount: count,
          })
        }
      }
    })
  }
})

// Sort by confidence and sample count
learnedRules.sort((a, b) => {
  if (b.confidence !== a.confidence) return b.confidence - a.confidence
  return b.sampleCount - a.sampleCount
})

// Remove duplicates and select best rules per category
const bestRules = new Map<string, LearnedRule[]>()
learnedRules.forEach(rule => {
  if (!bestRules.has(rule.category)) {
    bestRules.set(rule.category, [])
  }
  const rules = bestRules.get(rule.category)!

  // Check if pattern is substring of existing or vice versa
  const isDuplicate = rules.some(r =>
    r.pattern.includes(rule.pattern) || rule.pattern.includes(r.pattern)
  )

  if (!isDuplicate && rules.length < 3) { // Max 3 rules per category
    rules.push(rule)
  }
})

// Output results
console.log('=== Learned Rules ===\n')

let totalRules = 0
const outputRules: any[] = []

bestRules.forEach((rules, category) => {
  if (rules.length > 0) {
    console.log(`\n### ${category} ###`)
    rules.forEach((rule, i) => {
      console.log(`  ${i + 1}. [${rule.field}] "${rule.pattern}" (${rule.confidence}% confidence, ${rule.sampleCount} samples)`)
      outputRules.push({
        category: rule.category,
        field: rule.field,
        pattern: rule.pattern,
        isRegex: false,
        priority: rule.field === 'note' ? 1 : 2,
        confidence: rule.confidence,
      })
      totalRules++
    })
  }
})

console.log(`\n\n=== Total: ${totalRules} rules for ${bestRules.size} categories ===`)

// Save to JSON
fs.writeFileSync(
  'C:\\Users\\OatJirakitt\\Documents\\GitHub\\menu-db\\scripts\\learned-rules.json',
  JSON.stringify(outputRules, null, 2)
)

console.log('\nSaved to scripts/learned-rules.json')
