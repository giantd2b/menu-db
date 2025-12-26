import { PrismaClient } from '@/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import { Prisma } from '@/generated/prisma'

// Test-specific account number prefix to isolate test data
export const TEST_ACCOUNT_PREFIX = 'TEST_'

// Create a separate Prisma client for tests
function createTestPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  })
  return new PrismaClient({ adapter })
}

export const testPrisma = createTestPrismaClient()

/**
 * Clean up all test transactions (those with TEST_ prefix in accountNumber)
 */
export async function cleanupTestTransactions() {
  await testPrisma.transaction.deleteMany({
    where: {
      accountNumber: {
        startsWith: TEST_ACCOUNT_PREFIX,
      },
    },
  })
}

/**
 * Clean up test categories
 */
export async function cleanupTestCategories() {
  await testPrisma.category.deleteMany({
    where: {
      name: {
        startsWith: TEST_ACCOUNT_PREFIX,
      },
    },
  })
}

/**
 * Ensure a test category exists
 */
export async function ensureTestCategory(name: string = 'TEST_Category') {
  return testPrisma.category.upsert({
    where: { name },
    update: {},
    create: {
      name,
      description: 'Test category',
      color: '#888888',
    },
  })
}

/**
 * Create a test transaction
 */
export async function createTestTransaction(data: {
  date: Date
  accountNumber?: string
  balance: number
  withdrawal?: number | null
  deposit?: number | null
  description?: string
  note?: string
  categoryId?: string
}) {
  const accountNumber = data.accountNumber || `${TEST_ACCOUNT_PREFIX}${Date.now()}`

  return testPrisma.transaction.create({
    data: {
      date: data.date,
      accountNumber,
      balance: new Prisma.Decimal(data.balance),
      withdrawal: data.withdrawal != null ? new Prisma.Decimal(data.withdrawal) : null,
      deposit: data.deposit != null ? new Prisma.Decimal(data.deposit) : null,
      description: data.description || 'Test transaction',
      rawDescription: data.description || 'Test transaction',
      note: data.note,
      categoryId: data.categoryId,
    },
  })
}

/**
 * Upsert a test transaction (mimics the save logic)
 * Note: Prisma upsert doesn't support null in composite unique where clause,
 * so we use findFirst + create/update pattern for null withdrawal cases
 */
export async function upsertTestTransaction(data: {
  date: Date
  accountNumber: string
  balance: number
  withdrawal: number | null
  deposit?: number | null
  description?: string
  note?: string
  categoryId?: string
}) {
  // For null withdrawal, use findFirst pattern since Prisma upsert doesn't support null in where
  if (data.withdrawal === null) {
    const existing = await testPrisma.transaction.findFirst({
      where: {
        date: data.date,
        accountNumber: data.accountNumber,
        balance: new Prisma.Decimal(data.balance),
        withdrawal: null,
      },
    })

    if (existing) {
      return testPrisma.transaction.update({
        where: { id: existing.id },
        data: {
          description: data.description || 'Updated transaction',
          rawDescription: data.description || 'Updated transaction',
          note: data.note,
          categoryId: data.categoryId,
        },
      })
    } else {
      return testPrisma.transaction.create({
        data: {
          date: data.date,
          accountNumber: data.accountNumber,
          balance: new Prisma.Decimal(data.balance),
          withdrawal: null,
          deposit: data.deposit != null ? new Prisma.Decimal(data.deposit) : null,
          description: data.description || 'Test transaction',
          rawDescription: data.description || 'Test transaction',
          note: data.note,
          categoryId: data.categoryId,
        },
      })
    }
  }

  // For non-null withdrawal, use normal upsert
  return testPrisma.transaction.upsert({
    where: {
      unique_transaction: {
        date: data.date,
        accountNumber: data.accountNumber,
        balance: new Prisma.Decimal(data.balance),
        withdrawal: new Prisma.Decimal(data.withdrawal),
      },
    },
    update: {
      description: data.description || 'Updated transaction',
      rawDescription: data.description || 'Updated transaction',
      note: data.note,
      categoryId: data.categoryId,
    },
    create: {
      date: data.date,
      accountNumber: data.accountNumber,
      balance: new Prisma.Decimal(data.balance),
      withdrawal: new Prisma.Decimal(data.withdrawal),
      deposit: data.deposit != null ? new Prisma.Decimal(data.deposit) : null,
      description: data.description || 'Test transaction',
      rawDescription: data.description || 'Test transaction',
      note: data.note,
      categoryId: data.categoryId,
    },
  })
}

/**
 * Count test transactions
 */
export async function countTestTransactions(accountNumber?: string) {
  return testPrisma.transaction.count({
    where: {
      accountNumber: accountNumber || {
        startsWith: TEST_ACCOUNT_PREFIX,
      },
    },
  })
}

/**
 * Get all test transactions
 */
export async function getTestTransactions(accountNumber?: string) {
  return testPrisma.transaction.findMany({
    where: {
      accountNumber: accountNumber || {
        startsWith: TEST_ACCOUNT_PREFIX,
      },
    },
    orderBy: { date: 'asc' },
  })
}

/**
 * Disconnect test Prisma client
 */
export async function disconnectTestDb() {
  await testPrisma.$disconnect()
}
