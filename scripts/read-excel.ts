import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const filePath = 'C:\\Users\\OatJirakitt\\Downloads\\statement-2023.xlsx'

// Read the file
const buffer = fs.readFileSync(filePath)
const workbook = XLSX.read(buffer, { type: 'buffer' })

console.log('=== Sheet Names ===')
console.log(workbook.SheetNames)

// Read first sheet
const firstSheet = workbook.Sheets[workbook.SheetNames[0]]

// Get headers
const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1')
console.log('\n=== Headers (Row 1) ===')
const headers: string[] = []
for (let col = range.s.c; col <= range.e.c; col++) {
  const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
  const cell = firstSheet[cellAddress]
  const value = cell ? cell.v : ''
  headers.push(String(value))
  console.log(`Col ${col}: ${value}`)
}

// Convert to JSON
const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' })

console.log(`\n=== Total Rows: ${jsonData.length} ===`)

// Show first 20 rows
console.log('\n=== First 20 Rows ===')
jsonData.slice(0, 20).forEach((row: any, i: number) => {
  console.log(`\n--- Row ${i + 1} ---`)
  Object.keys(row).forEach(key => {
    if (row[key]) {
      console.log(`  ${key}: ${row[key]}`)
    }
  })
})

// Analyze unique values for key columns
console.log('\n=== Unique Tr Description ===')
const uniqueTrDesc = new Set(jsonData.map((r: any) => r['Tr Description']).filter(Boolean))
Array.from(uniqueTrDesc).slice(0, 50).forEach(v => console.log(`- ${v}`))

console.log('\n=== Unique Description ===')
const uniqueDesc = new Set(jsonData.map((r: any) => r['Description']).filter(Boolean))
Array.from(uniqueDesc).slice(0, 50).forEach(v => console.log(`- ${v}`))

console.log('\n=== Unique Channel ===')
const uniqueChannel = new Set(jsonData.map((r: any) => r['Channel']).filter(Boolean))
Array.from(uniqueChannel).forEach(v => console.log(`- ${v}`))

console.log('\n=== Unique Tr Code ===')
const uniqueCode = new Set(jsonData.map((r: any) => r['Tr Code']).filter(Boolean))
Array.from(uniqueCode).forEach(v => console.log(`- ${v}`))

console.log('\n=== Unique Note ===')
const uniqueNote = new Set(jsonData.map((r: any) => r['Note']).filter(Boolean))
Array.from(uniqueNote).slice(0, 30).forEach(v => console.log(`- ${v}`))
