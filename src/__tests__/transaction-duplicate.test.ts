import { describe, it, expect } from 'vitest'
import { categorizeTransaction } from '@/lib/utils/categorize'

/**
 * Helper function to generate unique transaction key
 * Based on: date + accountNumber + balance + withdrawal
 */
function generateTransactionKey(transaction: {
  date: Date
  accountNumber: string | null
  balance: number
  withdrawal: number | null
}): string {
  const dateStr = transaction.date.toISOString()
  const accountNumber = transaction.accountNumber || ''
  const balance = transaction.balance.toFixed(2)
  const withdrawal = transaction.withdrawal?.toFixed(2) || 'null'

  return `${dateStr}|${accountNumber}|${balance}|${withdrawal}`
}

/**
 * Check if two transactions are duplicates based on unique key
 */
function isDuplicate(
  tx1: { date: Date; accountNumber: string | null; balance: number; withdrawal: number | null },
  tx2: { date: Date; accountNumber: string | null; balance: number; withdrawal: number | null }
): boolean {
  return generateTransactionKey(tx1) === generateTransactionKey(tx2)
}

describe('Transaction Duplicate Detection', () => {
  describe('generateTransactionKey', () => {
    it('should generate consistent key for same transaction', () => {
      const tx = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 50000.00,
        withdrawal: 1500.00,
      }

      const key1 = generateTransactionKey(tx)
      const key2 = generateTransactionKey(tx)

      expect(key1).toBe(key2)
    })

    it('should handle null accountNumber', () => {
      const tx = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: null,
        balance: 50000.00,
        withdrawal: 1500.00,
      }

      const key = generateTransactionKey(tx)
      expect(key).toContain('||') // empty accountNumber
    })

    it('should handle null withdrawal (deposit transaction)', () => {
      const tx = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 50000.00,
        withdrawal: null,
      }

      const key = generateTransactionKey(tx)
      expect(key).toContain('|null')
    })
  })

  describe('isDuplicate', () => {
    it('should detect exact duplicate transactions', () => {
      const tx1 = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 50000.00,
        withdrawal: 1500.00,
      }
      const tx2 = { ...tx1 }

      expect(isDuplicate(tx1, tx2)).toBe(true)
    })

    it('should NOT detect duplicate when date is different', () => {
      const tx1 = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 50000.00,
        withdrawal: 1500.00,
      }
      const tx2 = {
        ...tx1,
        date: new Date('2024-01-16T10:30:00.000Z'),
      }

      expect(isDuplicate(tx1, tx2)).toBe(false)
    })

    it('should NOT detect duplicate when accountNumber is different', () => {
      const tx1 = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 50000.00,
        withdrawal: 1500.00,
      }
      const tx2 = {
        ...tx1,
        accountNumber: '0987654321',
      }

      expect(isDuplicate(tx1, tx2)).toBe(false)
    })

    it('should NOT detect duplicate when balance is different', () => {
      const tx1 = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 50000.00,
        withdrawal: 1500.00,
      }
      const tx2 = {
        ...tx1,
        balance: 48500.00,
      }

      expect(isDuplicate(tx1, tx2)).toBe(false)
    })

    it('should NOT detect duplicate when withdrawal is different', () => {
      const tx1 = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 50000.00,
        withdrawal: 1500.00,
      }
      const tx2 = {
        ...tx1,
        withdrawal: 2000.00,
      }

      expect(isDuplicate(tx1, tx2)).toBe(false)
    })

    it('should differentiate between withdrawal and deposit on same day/account/balance', () => {
      // This is the key scenario that adding withdrawal to unique key solves!
      const withdrawalTx = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 50000.00,
        withdrawal: 1500.00,
      }
      const depositTx = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 50000.00,
        withdrawal: null, // This is a deposit, no withdrawal
      }

      expect(isDuplicate(withdrawalTx, depositTx)).toBe(false)
    })

    it('should detect duplicate deposit transactions', () => {
      const tx1 = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 50000.00,
        withdrawal: null,
      }
      const tx2 = { ...tx1 }

      expect(isDuplicate(tx1, tx2)).toBe(true)
    })

    it('should handle same day multiple different withdrawals', () => {
      const baseDate = new Date('2024-01-15T10:30:00.000Z')
      const accountNumber = '1234567890'

      const tx1 = {
        date: baseDate,
        accountNumber,
        balance: 50000.00,
        withdrawal: 500.00,
      }
      const tx2 = {
        date: baseDate,
        accountNumber,
        balance: 49500.00,
        withdrawal: 1000.00,
      }
      const tx3 = {
        date: baseDate,
        accountNumber,
        balance: 48500.00,
        withdrawal: 500.00, // Same withdrawal amount as tx1 but different balance
      }

      expect(isDuplicate(tx1, tx2)).toBe(false)
      expect(isDuplicate(tx1, tx3)).toBe(false)
      expect(isDuplicate(tx2, tx3)).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero withdrawal', () => {
      const tx1 = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 50000.00,
        withdrawal: 0,
      }
      const tx2 = {
        ...tx1,
        withdrawal: null,
      }

      // 0 and null should be different
      expect(isDuplicate(tx1, tx2)).toBe(false)
    })

    it('should handle decimal precision with toFixed(2)', () => {
      const tx1 = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 50000.01,
        withdrawal: 1500.00,
      }
      const tx2 = {
        ...tx1,
        balance: 50000.02, // Different by 0.01
      }

      // These should be different
      expect(isDuplicate(tx1, tx2)).toBe(false)

      // Same value should be duplicate
      const tx3 = { ...tx1, balance: 50000.01 }
      expect(isDuplicate(tx1, tx3)).toBe(true)
    })

    it('should handle very large amounts', () => {
      const tx1 = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '1234567890',
        balance: 999999999.99,
        withdrawal: 50000000.00,
      }
      const tx2 = { ...tx1 }

      expect(isDuplicate(tx1, tx2)).toBe(true)
    })

    it('should handle empty account number vs null', () => {
      const tx1 = {
        date: new Date('2024-01-15T10:30:00.000Z'),
        accountNumber: '',
        balance: 50000.00,
        withdrawal: 1500.00,
      }
      const tx2 = {
        ...tx1,
        accountNumber: null,
      }

      // Both should be treated as empty string
      expect(isDuplicate(tx1, tx2)).toBe(true)
    })
  })
})

describe('Real World Scenarios', () => {
  it('should handle typical bank statement with multiple transactions per day', () => {
    const transactions = [
      // Morning coffee
      { date: new Date('2024-01-15T08:00:00.000Z'), accountNumber: '1234567890', balance: 50000.00, withdrawal: 85.00 },
      // Lunch
      { date: new Date('2024-01-15T12:00:00.000Z'), accountNumber: '1234567890', balance: 49915.00, withdrawal: 250.00 },
      // ATM withdrawal
      { date: new Date('2024-01-15T14:00:00.000Z'), accountNumber: '1234567890', balance: 49665.00, withdrawal: 5000.00 },
      // Salary deposit
      { date: new Date('2024-01-15T18:00:00.000Z'), accountNumber: '1234567890', balance: 44665.00, withdrawal: null },
    ]

    // All should be unique
    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        expect(isDuplicate(transactions[i], transactions[j])).toBe(false)
      }
    }
  })

  it('should detect duplicate when same file is uploaded twice', () => {
    const originalTx = {
      date: new Date('2024-01-15T10:30:00.000Z'),
      accountNumber: '1234567890',
      balance: 50000.00,
      withdrawal: 1500.00,
    }

    // Simulating second upload of same file
    const duplicateTx = { ...originalTx }

    expect(isDuplicate(originalTx, duplicateTx)).toBe(true)
  })

  it('should handle overlapping statement periods correctly', () => {
    // Statement 1: Jan 1-15
    const statement1Tx = {
      date: new Date('2024-01-10T10:30:00.000Z'),
      accountNumber: '1234567890',
      balance: 50000.00,
      withdrawal: 1500.00,
    }

    // Statement 2: Jan 10-25 (overlapping period)
    const statement2Tx = { ...statement1Tx } // Same transaction appears in both statements

    expect(isDuplicate(statement1Tx, statement2Tx)).toBe(true)
  })
})

describe('Inter-Company Transfer Categorization', () => {
  const createMockTransaction = (note: string, description: string = '') => ({
    date: new Date(),
    description,
    rawDescription: description,
    note,
    withdrawal: 50000,
    deposit: null,
    balance: 100000,
    accountNumber: '1234567890',
    accountName: null,
    accountType: null,
    channel: null,
    transactionCode: null,
    chequeNumber: null,
  })

  it('should categorize transfer to เติมบุญ as inter-company transfer', () => {
    const tx = createMockTransaction('โอนเงินให้เติมบุญ')
    expect(categorizeTransaction(tx)).toBe('เงินโอนระหว่างบัญชีบริษัท')
  })

  it('should categorize transfer to ไอริส as inter-company transfer', () => {
    const tx = createMockTransaction('โอนไอริส')
    expect(categorizeTransaction(tx)).toBe('เงินโอนระหว่างบัญชีบริษัท')
  })

  it('should detect เติมบุญ in description', () => {
    const tx = createMockTransaction('', 'โอนเงินไปบัญชีเติมบุญ')
    expect(categorizeTransaction(tx)).toBe('เงินโอนระหว่างบัญชีบริษัท')
  })

  it('should detect ไอริส in description', () => {
    const tx = createMockTransaction('', 'Transfer to IRIS Company')
    expect(categorizeTransaction(tx)).toBe('เงินโอนระหว่างบัญชีบริษัท')
  })

  it('should detect TERMBOON in English description', () => {
    const tx = createMockTransaction('', 'TERMBOON CO LTD')
    expect(categorizeTransaction(tx)).toBe('เงินโอนระหว่างบัญชีบริษัท')
  })

  it('should have highest priority (priority 0)', () => {
    // Even if note contains other keywords, เติมบุญ should take priority
    const tx = createMockTransaction('โอนเติมบุญ ค่าน้ำมัน')
    expect(categorizeTransaction(tx)).toBe('เงินโอนระหว่างบัญชีบริษัท')
  })

  it('should NOT categorize unrelated transfers as inter-company', () => {
    const tx = createMockTransaction('โอนเงินให้พนักงาน')
    expect(categorizeTransaction(tx)).not.toBe('เงินโอนระหว่างบัญชีบริษัท')
  })

  it('should detect ไอริส เติมบุญ in accountName field', () => {
    const tx = {
      ...createMockTransaction(''),
      accountName: 'บริษัท ไอริส เติมบุญ จำกัด',
    }
    expect(categorizeTransaction(tx)).toBe('เงินโอนระหว่างบัญชีบริษัท')
  })
})
