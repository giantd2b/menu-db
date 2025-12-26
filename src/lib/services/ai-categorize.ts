import Anthropic from '@anthropic-ai/sdk'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import trainingExamples from '@/lib/data/training-examples.json'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface TransactionForAI {
  note: string
  description: string
  withdrawal?: number
  deposit?: number
}

interface AICategorizationResult {
  category: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

// Training examples from manual categorization
const trainingData = trainingExamples as Record<string, { note: string; description: string }[]>

// Get Thai categories for AI context (filter out English ones)
async function getCategoryList(): Promise<string[]> {
  const categories = await prisma.category.findMany({
    select: { name: true },
    orderBy: { name: 'asc' },
  })

  // Filter to only Thai categories (those with Thai characters)
  const thaiCategories = categories
    .map(c => c.name)
    .filter(name => /[\u0E00-\u0E7F]/.test(name))

  return thaiCategories
}

// Build few-shot examples for the prompt
function buildFewShotExamples(): string {
  const examples: string[] = []

  // Select diverse examples from each category (2 per category, up to 30 categories)
  const categories = Object.keys(trainingData).slice(0, 30)

  for (const category of categories) {
    const categoryExamples = trainingData[category]?.slice(0, 2) || []
    for (const ex of categoryExamples) {
      examples.push(`Note: "${ex.note}" → หมวดหมู่: ${category}`)
    }
  }

  return examples.join('\n')
}

// Get user corrections from database for learning
async function getUserCorrections(): Promise<string> {
  try {
    const corrections = await prisma.aICorrection.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50, // ใช้ 50 corrections ล่าสุด
    })

    if (corrections.length === 0) return ''

    const examples = corrections.map(c =>
      `Note: "${c.note}" → หมวดหมู่: ${c.userCategory} (แก้ไขจาก: ${c.aiCategory})`
    )

    return examples.join('\n')
  } catch (error) {
    console.error('Error fetching corrections:', error)
    return ''
  }
}

// Categorize a single transaction using AI
export async function categorizeWithAI(
  transaction: TransactionForAI
): Promise<AICategorizationResult | null> {
  try {
    const categories = await getCategoryList()

    // Build few-shot examples from training data
    const fewShotExamples = buildFewShotExamples()

    // Get user corrections for learning
    const userCorrections = await getUserCorrections()

    const prompt = `คุณเป็นผู้เชี่ยวชาญด้านบัญชีสำหรับธุรกิจจัดเลี้ยงและอีเว้นท์ในประเทศไทย

ให้วิเคราะห์รายการค่าใช้จ่ายนี้และเลือกหมวดหมู่ที่เหมาะสมที่สุด:

📝 Note (สำคัญที่สุด): "${transaction.note || '(ไม่มี)'}"
📄 Description: "${transaction.description || '(ไม่มี)'}"
💰 จำนวนเงิน: ${transaction.withdrawal || transaction.deposit} บาท

⚠️ กฎสำคัญ:
1. ดู Note เป็นหลัก (สำคัญกว่า Description)
2. เลือกหมวดหมู่จากรายการด้านล่างเท่านั้น
3. ถ้าไม่แน่ใจ ให้เลือก "ไม่ระบุ"

หมวดหมู่ที่เลือกได้:
${categories.map((c, i) => `${i + 1}. ${c}`).join('\n')}

=== ตัวอย่างจากข้อมูลจริง ===
${fewShotExamples}
${userCorrections ? `\n=== การแก้ไขจาก User (สำคัญมาก - ให้ความสำคัญกว่าตัวอย่างอื่น) ===\n${userCorrections}` : ''}

ตอบในรูปแบบ JSON:
{
  "category": "ชื่อหมวดหมู่",
  "confidence": "high/medium/low",
  "reasoning": "เหตุผลสั้นๆ"
}`

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : ''

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('AI response not in JSON format:', responseText)
      return null
    }

    const result = JSON.parse(jsonMatch[0]) as AICategorizationResult

    // Validate category exists
    if (!categories.includes(result.category)) {
      // Try to find closest match
      const closestMatch = categories.find(c =>
        c.toLowerCase().includes(result.category.toLowerCase()) ||
        result.category.toLowerCase().includes(c.toLowerCase())
      )
      if (closestMatch) {
        result.category = closestMatch
      } else {
        result.category = 'ไม่ระบุ'
        result.confidence = 'low'
      }
    }

    return result
  } catch (error) {
    console.error('AI categorization error:', error)
    return null
  }
}

// Batch categorize multiple transactions
export async function batchCategorizeWithAI(
  transactions: TransactionForAI[],
  batchSize: number = 5
): Promise<Map<number, AICategorizationResult>> {
  const results = new Map<number, AICategorizationResult>()

  // Process in batches to avoid rate limits
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize)

    const batchPromises = batch.map(async (tx, idx) => {
      const result = await categorizeWithAI(tx)
      return { index: i + idx, result }
    })

    const batchResults = await Promise.all(batchPromises)

    for (const { index, result } of batchResults) {
      if (result) {
        results.set(index, result)
      }
    }

    // Small delay between batches
    if (i + batchSize < transactions.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  return results
}

// Categorize uncategorized transactions in the database
export async function categorizeUnmatchedTransactions(
  limit: number = 50
): Promise<{
  processed: number
  categorized: number
  results: { id: string; category: string; confidence: string }[]
}> {
  // Find transactions without category (or with 'ไม่ระบุ')
  const uncategorized = await prisma.transaction.findMany({
    where: {
      OR: [
        { categoryId: null },
        { category: { name: 'ไม่ระบุ' } },
      ],
      withdrawal: { gt: 0 }, // Only withdrawals
    },
    take: limit,
    select: {
      id: true,
      note: true,
      rawDescription: true,
      withdrawal: true,
      deposit: true,
    },
  })

  const results: { id: string; category: string; confidence: string }[] = []
  let categorized = 0

  for (const tx of uncategorized) {
    const aiResult = await categorizeWithAI({
      note: tx.note || '',
      description: tx.rawDescription || '',
      withdrawal: tx.withdrawal ? Number(tx.withdrawal) : undefined,
      deposit: tx.deposit ? Number(tx.deposit) : undefined,
    })

    if (aiResult && aiResult.category !== 'ไม่ระบุ' && aiResult.confidence !== 'low') {
      // Find category in database
      const category = await prisma.category.findUnique({
        where: { name: aiResult.category },
      })

      if (category) {
        // Update transaction
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { categoryId: category.id },
        })

        categorized++
        results.push({
          id: tx.id,
          category: aiResult.category,
          confidence: aiResult.confidence,
        })
      }
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  // Revalidate dashboard to show updated data
  if (categorized > 0) {
    revalidatePath('/dashboard')
  }

  return {
    processed: uncategorized.length,
    categorized,
    results,
  }
}
