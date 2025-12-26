/**
 * Utility functions for cleaning bank statement data
 */

/**
 * แปลง String ตัวเลขที่มี comma เป็น Number
 * เช่น "1,000.00" → 1000.00
 * @param value - String หรือ Number ที่ต้องการแปลง
 * @returns number หรือ null ถ้าไม่สามารถแปลงได้
 */
export function parseNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number') {
    return value
  }

  // ลบ comma และ whitespace
  const cleanedValue = value.toString().replace(/,/g, '').trim()

  if (cleanedValue === '' || cleanedValue === 'NaN') {
    return null
  }

  const parsed = parseFloat(cleanedValue)
  return isNaN(parsed) ? null : parsed
}

/**
 * แปลงวันที่จาก format 'DD/MM/YYYY' และเวลา 'HH:mm' เป็น Date Object
 * @param dateStr - วันที่ในรูปแบบ DD/MM/YYYY
 * @param timeStr - เวลาในรูปแบบ HH:mm (optional)
 * @returns Date object หรือ null ถ้าไม่สามารถแปลงได้
 */
export function parseDate(dateStr: string | null | undefined, timeStr?: string | null): Date | null {
  if (!dateStr) {
    return null
  }

  // รองรับ format DD/MM/YYYY
  const dateParts = dateStr.split('/')
  if (dateParts.length !== 3) {
    return null
  }

  const [day, month, year] = dateParts.map(Number)

  // ตรวจสอบค่าที่ได้
  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return null
  }

  // Parse time ถ้ามี
  let hours = 0
  let minutes = 0

  if (timeStr) {
    const timeParts = timeStr.split(':')
    if (timeParts.length >= 2) {
      hours = parseInt(timeParts[0], 10) || 0
      minutes = parseInt(timeParts[1], 10) || 0
    }
  }

  // สร้าง Date object (month เป็น 0-indexed)
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0)

  // ตรวจสอบว่า Date ถูกต้อง
  if (isNaN(date.getTime())) {
    return null
  }

  return date
}

/**
 * โครงสร้างข้อมูล raw จาก CSV
 */
export interface RawTransactionRow {
  'Account Number'?: string
  'Account Name'?: string
  'Account Type'?: string
  'Currency Code'?: string
  'Branch Code'?: string
  'Date'?: string
  'Time'?: string
  'Tr Code'?: string
  'Tr Description'?: string
  'Channel'?: string
  'Cheque No.'?: string
  'Withdrawal'?: string
  'Deposit'?: string
  'Outstanding Balance'?: string
  'Description'?: string
  'Note'?: string
  'chart'?: string // คอลัมน์ที่ user เพิ่มเอง (optional)
  // Allow for flexible column names
  [key: string]: string | undefined
}

/**
 * Get value from row with flexible column name matching
 * Tries exact match first, then case-insensitive match
 */
function getFlexValue(row: RawTransactionRow, ...possibleNames: string[]): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowAny = row as Record<string, any>

  // Try exact matches first
  for (const name of possibleNames) {
    if (rowAny[name] !== undefined) {
      return rowAny[name]
    }
  }

  // Try case-insensitive and trimmed matches
  const keys = Object.keys(row)
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().trim()
    for (const key of keys) {
      if (key.toLowerCase().trim() === normalizedName) {
        return rowAny[key]
      }
    }
  }

  return undefined
}

/**
 * โครงสร้างข้อมูลที่ cleaned แล้ว
 */
export interface CleanedTransaction {
  accountNumber: string | null
  accountName: string | null
  accountType: string | null
  date: Date
  description: string
  rawDescription: string
  note: string | null
  withdrawal: number | null
  deposit: number | null
  balance: number
  channel: string | null
  transactionCode: string | null
  chequeNumber: string | null
  chart: string | null // หมวดหมู่ที่ user ระบุเอง (optional)
}

/**
 * Clean ข้อมูล transaction จาก raw row
 * @param row - ข้อมูล raw จาก CSV
 * @returns CleanedTransaction หรือ null ถ้าข้อมูลไม่ถูกต้อง
 */
export function cleanTransactionRow(row: RawTransactionRow): CleanedTransaction | null {
  // Debug: log available columns and values for transactions with inter-company keywords
  const allValues = Object.values(row).join(' ')
  if (allValues.includes('ไอริส') || allValues.includes('เติมบุญ') || allValues.toLowerCase().includes('iris') || allValues.toLowerCase().includes('termboon')) {
    console.log('[Clean-Data Debug] Raw row columns:', Object.keys(row))
    console.log('[Clean-Data Debug] Raw row values:', row)
  }

  // Use flexible column name matching
  const dateStr = getFlexValue(row, 'Date', 'วันที่')
  const timeStr = getFlexValue(row, 'Time', 'เวลา')
  const balanceStr = getFlexValue(row, 'Outstanding Balance', 'Balance', 'ยอดคงเหลือ')
  const withdrawalStr = getFlexValue(row, 'Withdrawal', 'ถอน', 'เงินออก')
  const depositStr = getFlexValue(row, 'Deposit', 'ฝาก', 'เงินเข้า')

  // Parse วันที่ - ต้องมี
  const date = parseDate(dateStr, timeStr)
  if (!date) {
    return null
  }

  // Parse balance - ต้องมี
  const balance = parseNumber(balanceStr)
  if (balance === null) {
    return null
  }

  // Parse withdrawal และ deposit
  const withdrawal = parseNumber(withdrawalStr)
  const deposit = parseNumber(depositStr)

  // อย่างน้อยต้องมี withdrawal หรือ deposit
  if (withdrawal === null && deposit === null) {
    return null
  }

  // Get description fields with flexible matching
  const trDescription = getFlexValue(row, 'Tr Description', 'Transaction Description')?.trim() || ''
  const rawDescription = getFlexValue(row, 'Description', 'รายละเอียด')?.trim() || ''
  const note = getFlexValue(row, 'Note', 'หมายเหตุ', 'Memo')?.trim() || null

  // Debug: Log what description fields were found for inter-company transactions
  if (allValues.includes('ไอริส') || allValues.includes('เติมบุญ')) {
    console.log('[Clean-Data Debug] Mapped fields:', {
      trDescription,
      rawDescription,
      note,
    })
  }

  return {
    accountNumber: getFlexValue(row, 'Account Number', 'เลขบัญชี')?.trim() || null,
    accountName: getFlexValue(row, 'Account Name', 'ชื่อบัญชี')?.trim() || null,
    accountType: getFlexValue(row, 'Account Type', 'ประเภทบัญชี')?.trim() || null,
    date,
    description: trDescription,
    rawDescription,
    note,
    withdrawal,
    deposit,
    balance,
    channel: getFlexValue(row, 'Channel', 'ช่องทาง')?.trim() || null,
    transactionCode: getFlexValue(row, 'Tr Code', 'รหัสรายการ')?.trim() || null,
    chequeNumber: getFlexValue(row, 'Cheque No.', 'เช็ค')?.trim() || null,
    chart: getFlexValue(row, 'chart', 'หมวดหมู่', 'Category')?.trim() || null,
  }
}
