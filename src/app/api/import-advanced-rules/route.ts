import { importAdvancedRules } from '@/lib/actions/import-advanced-rules'
import { NextResponse } from 'next/server'

export async function POST() {
  const result = await importAdvancedRules()
  return NextResponse.json(result)
}
