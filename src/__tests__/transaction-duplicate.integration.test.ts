import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  testPrisma,
  cleanupTestTransactions,
  createTestTransaction,
  upsertTestTransaction,
  countTestTransactions,
  getTestTransactions,
  disconnectTestDb,
  TEST_ACCOUNT_PREFIX,
} from './helpers/test-db'

const TEST_ACCOUNT = `${TEST_ACCOUNT_PREFIX}integration`

describe('Transaction Duplicate Detection (Integration)', () => {
  beforeAll(async () => {
    // Ensure database is connected
    await testPrisma.$connect()
  })

  afterAll(async () => {
    // Clean up and disconnect
    await cleanupTestTransactions()
    await disconnectTestDb()
  })

  beforeEach(async () => {
    // Clean up test data before each test
    await cleanupTestTransactions()
  })

  describe('Unique Constraint', () => {
    it('should create a new transaction', async () => {
      const tx = await createTestTransaction({
        date: new Date('2024-01-15T10:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 50000,
        withdrawal: 1500,
        description: 'Test transaction 1',
      })

      expect(tx).toBeDefined()
      expect(tx.id).toBeDefined()
      expect(Number(tx.balance)).toBe(50000)
      expect(Number(tx.withdrawal)).toBe(1500)
    })

    it('should create multiple different transactions on same day', async () => {
      // Transaction 1: Morning withdrawal
      await createTestTransaction({
        date: new Date('2024-01-15T08:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 50000,
        withdrawal: 500,
        description: 'Morning coffee',
      })

      // Transaction 2: Lunch withdrawal (different balance & withdrawal)
      await createTestTransaction({
        date: new Date('2024-01-15T12:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 49500,
        withdrawal: 250,
        description: 'Lunch',
      })

      // Transaction 3: Deposit (null withdrawal)
      await createTestTransaction({
        date: new Date('2024-01-15T18:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 49250,
        withdrawal: null,
        deposit: 10000,
        description: 'Salary',
      })

      const count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(3)
    })

    it('should reject duplicate transaction with same unique key', async () => {
      const txData = {
        date: new Date('2024-01-15T10:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 50000,
        withdrawal: 1500,
        description: 'Original transaction',
      }

      // Create first transaction
      await createTestTransaction(txData)

      // Try to create duplicate - should throw unique constraint error
      await expect(
        createTestTransaction({
          ...txData,
          description: 'Duplicate transaction',
        })
      ).rejects.toThrow()

      // Should still only have 1 transaction
      const count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(1)
    })

    it('should allow same date/account/balance but different withdrawal', async () => {
      const baseData = {
        date: new Date('2024-01-15T10:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 50000,
      }

      // Withdrawal transaction
      await createTestTransaction({
        ...baseData,
        withdrawal: 1500,
        description: 'Withdrawal',
      })

      // Deposit transaction (null withdrawal) - should NOT be duplicate
      await createTestTransaction({
        ...baseData,
        withdrawal: null,
        deposit: 1500,
        description: 'Deposit',
      })

      const count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(2)

      const transactions = await getTestTransactions(TEST_ACCOUNT)
      expect(transactions[0].description).toBe('Withdrawal')
      expect(transactions[1].description).toBe('Deposit')
    })
  })

  describe('Upsert Behavior', () => {
    it('should create new transaction on first upsert', async () => {
      const result = await upsertTestTransaction({
        date: new Date('2024-01-15T10:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 50000,
        withdrawal: 1500,
        description: 'First insert',
      })

      expect(result).toBeDefined()
      expect(result.description).toBe('First insert')

      const count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(1)
    })

    it('should update existing transaction on duplicate upsert', async () => {
      const txData = {
        date: new Date('2024-01-15T10:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 50000,
        withdrawal: 1500,
      }

      // First upsert - creates new
      const first = await upsertTestTransaction({
        ...txData,
        description: 'Original description',
        note: 'Original note',
      })

      // Second upsert - should update
      const second = await upsertTestTransaction({
        ...txData,
        description: 'Updated description',
        note: 'Updated note',
      })

      // Should be same record
      expect(second.id).toBe(first.id)
      expect(second.description).toBe('Updated description')
      expect(second.note).toBe('Updated note')

      // Should still only have 1 transaction
      const count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(1)
    })

    it('should handle upsert with null withdrawal (deposit)', async () => {
      const txData = {
        date: new Date('2024-01-15T10:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 50000,
        withdrawal: null,
        deposit: 5000,
      }

      // First upsert
      await upsertTestTransaction({
        ...txData,
        description: 'Deposit 1',
      })

      // Second upsert with same key
      await upsertTestTransaction({
        ...txData,
        description: 'Deposit 1 updated',
      })

      const count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(1)

      const transactions = await getTestTransactions(TEST_ACCOUNT)
      expect(transactions[0].description).toBe('Deposit 1 updated')
    })

    it('should create separate records for withdrawal vs deposit with same date/balance', async () => {
      const baseData = {
        date: new Date('2024-01-15T10:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 50000,
      }

      // Upsert withdrawal
      await upsertTestTransaction({
        ...baseData,
        withdrawal: 1000,
        description: 'Withdrawal',
      })

      // Upsert deposit (null withdrawal) - different unique key
      await upsertTestTransaction({
        ...baseData,
        withdrawal: null,
        deposit: 1000,
        description: 'Deposit',
      })

      const count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(2)
    })
  })

  describe('Real World Scenarios', () => {
    it('should handle uploading same bank statement twice', async () => {
      const statementData = [
        { date: new Date('2024-01-10T08:00:00.000Z'), balance: 50000, withdrawal: 100, description: 'Coffee' },
        { date: new Date('2024-01-10T12:00:00.000Z'), balance: 49900, withdrawal: 250, description: 'Lunch' },
        { date: new Date('2024-01-10T18:00:00.000Z'), balance: 49650, withdrawal: null, deposit: 30000, description: 'Salary' },
      ]

      // First upload
      for (const tx of statementData) {
        await upsertTestTransaction({
          ...tx,
          accountNumber: TEST_ACCOUNT,
        })
      }

      let count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(3)

      // Second upload (same data)
      for (const tx of statementData) {
        await upsertTestTransaction({
          ...tx,
          accountNumber: TEST_ACCOUNT,
        })
      }

      // Should still be 3 (no duplicates created)
      count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(3)
    })

    it('should handle overlapping statement periods', async () => {
      // Statement 1: Jan 1-15
      const statement1 = [
        { date: new Date('2024-01-05T10:00:00.000Z'), balance: 50000, withdrawal: 500, description: 'Tx 1' },
        { date: new Date('2024-01-10T10:00:00.000Z'), balance: 49500, withdrawal: 1000, description: 'Tx 2' },
        { date: new Date('2024-01-15T10:00:00.000Z'), balance: 48500, withdrawal: 200, description: 'Tx 3' },
      ]

      // Statement 2: Jan 10-25 (overlapping Jan 10-15)
      const statement2 = [
        { date: new Date('2024-01-10T10:00:00.000Z'), balance: 49500, withdrawal: 1000, description: 'Tx 2' }, // Duplicate
        { date: new Date('2024-01-15T10:00:00.000Z'), balance: 48500, withdrawal: 200, description: 'Tx 3' }, // Duplicate
        { date: new Date('2024-01-20T10:00:00.000Z'), balance: 48300, withdrawal: 300, description: 'Tx 4' }, // New
        { date: new Date('2024-01-25T10:00:00.000Z'), balance: 48000, withdrawal: 150, description: 'Tx 5' }, // New
      ]

      // Upload statement 1
      for (const tx of statement1) {
        await upsertTestTransaction({ ...tx, accountNumber: TEST_ACCOUNT })
      }

      let count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(3)

      // Upload statement 2
      for (const tx of statement2) {
        await upsertTestTransaction({ ...tx, accountNumber: TEST_ACCOUNT })
      }

      // Should have 5 unique transactions (3 from statement 1, 2 new from statement 2)
      count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(5)
    })

    it('should handle category updates on re-upload', async () => {
      // First, ensure we have a test category
      const category = await testPrisma.category.upsert({
        where: { name: 'TEST_Food' },
        update: {},
        create: { name: 'TEST_Food', description: 'Food category' },
      })

      const txData = {
        date: new Date('2024-01-15T12:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 50000,
        withdrawal: 250,
        description: 'Lunch at restaurant',
      }

      // First upload without category
      await upsertTestTransaction(txData)

      let transactions = await getTestTransactions(TEST_ACCOUNT)
      expect(transactions[0].categoryId).toBeNull()

      // Re-upload with category assigned
      await upsertTestTransaction({
        ...txData,
        categoryId: category.id,
      })

      // Category should be updated
      transactions = await getTestTransactions(TEST_ACCOUNT)
      expect(transactions[0].categoryId).toBe(category.id)

      // Clean up test category
      await testPrisma.category.delete({ where: { name: 'TEST_Food' } })
    })

    it('should handle multiple accounts correctly', async () => {
      const account1 = `${TEST_ACCOUNT}_1`
      const account2 = `${TEST_ACCOUNT}_2`

      // Same transaction on different accounts
      const txData = {
        date: new Date('2024-01-15T10:00:00.000Z'),
        balance: 50000,
        withdrawal: 1500,
        description: 'Transfer',
      }

      await upsertTestTransaction({ ...txData, accountNumber: account1 })
      await upsertTestTransaction({ ...txData, accountNumber: account2 })

      // Should create 2 separate transactions
      const count1 = await countTestTransactions(account1)
      const count2 = await countTestTransactions(account2)

      expect(count1).toBe(1)
      expect(count2).toBe(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero withdrawal', async () => {
      const baseData = {
        date: new Date('2024-01-15T10:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 50000,
      }

      // Zero withdrawal
      await createTestTransaction({
        ...baseData,
        withdrawal: 0,
        description: 'Zero withdrawal',
      })

      // Null withdrawal (deposit)
      await createTestTransaction({
        ...baseData,
        withdrawal: null,
        deposit: 100,
        description: 'Deposit',
      })

      // Should be 2 different transactions
      const count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(2)
    })

    it('should handle very small decimal differences', async () => {
      const baseData = {
        date: new Date('2024-01-15T10:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
      }

      await createTestTransaction({
        ...baseData,
        balance: 50000.01,
        withdrawal: 100.01,
        description: 'Tx 1',
      })

      await createTestTransaction({
        ...baseData,
        balance: 50000.02,
        withdrawal: 100.02,
        description: 'Tx 2',
      })

      const count = await countTestTransactions(TEST_ACCOUNT)
      expect(count).toBe(2)
    })

    it('should handle large amounts', async () => {
      await createTestTransaction({
        date: new Date('2024-01-15T10:00:00.000Z'),
        accountNumber: TEST_ACCOUNT,
        balance: 999999999.99,
        withdrawal: 50000000.00,
        description: 'Large transaction',
      })

      const transactions = await getTestTransactions(TEST_ACCOUNT)
      expect(Number(transactions[0].balance)).toBe(999999999.99)
      expect(Number(transactions[0].withdrawal)).toBe(50000000.00)
    })
  })
})
