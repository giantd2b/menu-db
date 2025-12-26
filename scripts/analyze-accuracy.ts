import * as XLSX from 'xlsx'
import * as fs from 'fs'
import { PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

const filePath = 'C:\\Users\\OatJirakitt\\Downloads\\statement-2023.xlsx'

const buffer = fs.readFileSync(filePath)
const workbook = XLSX.read(buffer, { type: 'buffer' })
const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' }) as any[]

// Load rules from database
async function loadRulesFromDb() {
  const dbRules = await prisma.categoryRule.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { priority: 'asc' },
  })

  return dbRules.map(r => ({
    pattern: r.pattern,
    field: r.field as 'note' | 'description',
    category: r.category.name,
    priority: r.priority,
    isRegex: r.isRegex,
  }))
}

type Rule = {
  pattern: string
  field: 'note' | 'description'
  category: string
  priority: number
  isRegex: boolean
}

function matchRule(note: string, description: string, rules: Rule[]): string | null {
  for (const rule of rules) {
    const text = rule.field === 'note' ? note : description
    if (!text) continue

    if (rule.isRegex) {
      try {
        const regex = new RegExp(rule.pattern, 'i')
        if (regex.test(text)) {
          return rule.category
        }
      } catch {
        // Invalid regex, skip
      }
    } else {
      if (text.toLowerCase().includes(rule.pattern.toLowerCase())) {
        return rule.category
      }
    }
  }
  return null
}

// Main async function
async function analyze() {
  const RULES = await loadRulesFromDb()
  console.log(`\nLoaded ${RULES.length} rules from database\n`)

  let correct = 0
  let incorrect = 0
  let unmatched = 0

  const missedCategories = new Map<string, { count: number, samples: { note: string, desc: string }[] }>()

  jsonData.forEach(row => {
    const chart = row['chart']?.trim() || ''
    const note = row['Note']?.trim() || ''
    const description = row['Description']?.trim() || ''
    const withdrawal = parseFloat(row['Withdrawal']?.replace(/,/g, '') || '0')

    // Only check withdrawals
    if (!withdrawal || withdrawal <= 0) return
    if (!chart) return

    const predicted = matchRule(note, description, RULES)

    if (predicted === chart) {
      correct++
    } else if (predicted) {
      incorrect++
    } else {
      unmatched++

      // Track missed categories
      if (!missedCategories.has(chart)) {
        missedCategories.set(chart, { count: 0, samples: [] })
      }
      const data = missedCategories.get(chart)!
      data.count++
      if (data.samples.length < 5) {
        data.samples.push({ note, desc: description })
      }
    }
  })

  const total = correct + incorrect + unmatched
  console.log('=== Auto-Categorization Analysis ===\n')
  console.log(`Total withdrawals: ${total}`)
  console.log(`Correct: ${correct} (${(correct/total*100).toFixed(1)}%)`)
  console.log(`Incorrect: ${incorrect} (${(incorrect/total*100).toFixed(1)}%)`)
  console.log(`Unmatched: ${unmatched} (${(unmatched/total*100).toFixed(1)}%)`)

  console.log('\n=== Top Missed Categories (Need More Rules) ===\n')

  const sortedMissed = Array.from(missedCategories.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)

  sortedMissed.forEach(([category, data]) => {
    console.log(`\n### ${category} (${data.count} missed) ###`)
    console.log('Sample Notes/Descriptions:')
    data.samples.forEach((s, i) => {
      console.log(`  ${i+1}. Note: "${s.note}"`)
      console.log(`     Desc: "${s.desc.substring(0, 60)}..."`)
    })
  })

  // Suggest new rules
  console.log('\n\n=== Suggested New Rules ===\n')

  sortedMissed.forEach(([category, data]) => {
    // Find common patterns in missed samples
    const noteWords = new Map<string, number>()

    data.samples.forEach(s => {
      const words = s.note.split(/[\s,\-\/]+/).filter(w => w.length >= 3)
      words.forEach(w => {
        noteWords.set(w, (noteWords.get(w) || 0) + 1)
      })
    })

    const commonWords = Array.from(noteWords.entries())
      .filter(([_, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    if (commonWords.length > 0) {
      console.log(`${category}:`)
      commonWords.forEach(([word, count]) => {
        console.log(`  - pattern: "${word}" (found ${count}/${data.samples.length} samples)`)
      })
    }
  })

  await prisma.$disconnect()
}

// Run the analysis
analyze().catch(console.error)
