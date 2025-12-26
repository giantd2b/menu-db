import { categorizeUnmatchedTransactions, categorizeWithAI } from '@/lib/services/ai-categorize'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/ai-categorize?note=xxx - Test categorize via browser
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const note = searchParams.get('note') || ''
    const description = searchParams.get('description') || ''
    const withdrawal = parseFloat(searchParams.get('withdrawal') || '1000')

    const result = await categorizeWithAI({
      note,
      description,
      withdrawal,
    })

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'AI could not categorize' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      input: { note, description, withdrawal },
      ...result,
    })
  } catch (error) {
    console.error('AI categorization error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// POST /api/ai-categorize - Categorize unmatched transactions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit || 50

    const result = await categorizeUnmatchedTransactions(limit)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('AI categorization error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

// PUT /api/ai-categorize - Test categorize a single transaction
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { note, description, withdrawal, deposit } = body

    const result = await categorizeWithAI({
      note: note || '',
      description: description || '',
      withdrawal,
      deposit,
    })

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'AI could not categorize' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('AI categorization error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
