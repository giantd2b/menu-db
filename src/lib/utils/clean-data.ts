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
  // Parse วันที่ - ต้องมี
  const date = parseDate(row['Date'], row['Time'])
  if (!date) {
    return null
  }

  // Parse balance - ต้องมี
  const balance = parseNumber(row['Outstanding Balance'])
  if (balance === null) {
    return null
  }

  // Parse withdrawal และ deposit
  const withdrawal = parseNumber(row['Withdrawal'])
  const deposit = parseNumber(row['Deposit'])

  // อย่างน้อยต้องมี withdrawal หรือ deposit
  if (withdrawal === null && deposit === null) {
    return null
  }

  return {
    accountNumber: row['Account Number']?.trim() || null,
    accountName: row['Account Name']?.trim() || null,
    accountType: row['Account Type']?.trim() || null,
    date,
    description: row['Tr Description']?.trim() || '',
    rawDescription: row['Description']?.trim() || '',
    note: row['Note']?.trim() || null,
    withdrawal,
    deposit,
    balance,
    channel: row['Channel']?.trim() || null,
    transactionCode: row['Tr Code']?.trim() || null,
    chequeNumber: row['Cheque No.']?.trim() || null,
    chart: row['chart']?.trim() || null, // หมวดหมู่จาก user (ถ้ามี)
  }
}
